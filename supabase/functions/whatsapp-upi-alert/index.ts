import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { phoneNumber, type, amount, transactionRef, utrNumber, status, storeName } = await req.json();

    if (!phoneNumber) {
      throw new Error('Missing required field: phoneNumber');
    }

    const cleanPhone = phoneNumber.replace(/\D/g, '');
    const formattedPhone = cleanPhone.startsWith('91') ? cleanPhone : `91${cleanPhone}`;

    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);

    const shop = storeName || 'Store';

    let messageBody = '';
    if (type === 'new_payment') {
      messageBody = `🔔 *New UPI Payment Received*\n\n💰 Amount: *${formattedAmount}*\n📝 Ref: ${transactionRef}\n${utrNumber ? `🏦 UTR: ${utrNumber}` : ''}\n\n⏳ Status: Pending verification\n\n— ${shop}`;
    } else if (type === 'verified') {
      messageBody = `✅ *Payment Verified*\n\n💰 Amount: *${formattedAmount}*\n📝 Ref: ${transactionRef}\n${utrNumber ? `🏦 UTR: ${utrNumber}` : ''}\n\n✅ Your payment has been confirmed.\n\n— ${shop}`;
    } else if (type === 'rejected') {
      messageBody = `❌ *Payment Rejected*\n\n💰 Amount: *${formattedAmount}*\n📝 Ref: ${transactionRef}\n\nPlease contact the store for assistance.\n\n— ${shop}`;
    } else if (type === 'receipt') {
      messageBody = `🧾 *Payment Receipt*\n\n💰 Amount: *${formattedAmount}*\n📝 Ref: ${transactionRef}\n${utrNumber ? `🏦 UTR: ${utrNumber}` : ''}\n📅 Date: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}\n\n✅ VERIFIED\n\nThank you for your payment!\n\n— ${shop}`;
    }

    // Try to get WhatsApp API credentials from app_settings
    let whatsappToken: string | null = null;
    let whatsappPhoneId: string | null = null;

    try {
      const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
      const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
      const supabase = createClient(supabaseUrl, supabaseKey);

      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'paymentSettings')
        .maybeSingle();

      if (data?.value) {
        const v = data.value as Record<string, unknown>;
        if (typeof v.whatsappAccessToken === 'string' && v.whatsappAccessToken) {
          whatsappToken = v.whatsappAccessToken;
        }
        if (typeof v.whatsappPhoneNumberId === 'string' && v.whatsappPhoneNumberId) {
          whatsappPhoneId = v.whatsappPhoneNumberId;
        }
      }
    } catch (err) {
      console.warn('Could not fetch WhatsApp settings from DB:', err);
    }

    // Also check env secrets as fallback
    if (!whatsappToken) whatsappToken = Deno.env.get('WHATSAPP_ACCESS_TOKEN') || null;
    if (!whatsappPhoneId) whatsappPhoneId = Deno.env.get('WHATSAPP_PHONE_NUMBER_ID') || null;

    // If API credentials are available, send via Business API
    if (whatsappToken && whatsappPhoneId) {
      const res = await fetch(
        `https://graph.facebook.com/v21.0/${whatsappPhoneId}/messages`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${whatsappToken}`,
          },
          body: JSON.stringify({
            messaging_product: 'whatsapp',
            to: formattedPhone,
            type: 'text',
            text: { body: messageBody },
          }),
        }
      );

      const result = await res.json();

      if (!res.ok) {
        console.error('WhatsApp API error:', result);
        throw new Error(`WhatsApp send failed [${res.status}]: ${JSON.stringify(result)}`);
      }

      return new Response(JSON.stringify({ success: true, method: 'api', messageId: result.messages?.[0]?.id }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fallback: return a wa.me link for the admin to open on their device
    const encodedMessage = encodeURIComponent(messageBody);
    const waLink = `https://wa.me/${formattedPhone}?text=${encodedMessage}`;

    return new Response(JSON.stringify({ 
      success: true, 
      method: 'wa_link', 
      waLink,
      message: 'WhatsApp Business API not configured. Use the link to send manually.' 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('Error:', error);
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ success: false, error: msg }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
