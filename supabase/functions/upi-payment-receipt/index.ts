import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');

    const {
      customerEmail,
      customerName,
      amount,
      transactionRef,
      utrNumber,
      payerVpa,
      merchantVpa,
      orderId,
      storeName,
    } = await req.json();

    if (!customerEmail || !amount || !transactionRef) {
      throw new Error('Missing required fields: customerEmail, amount, transactionRef');
    }

    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);

    const receiptDate = new Date().toLocaleString('en-IN', {
      timeZone: 'Asia/Kolkata',
      dateStyle: 'long',
      timeStyle: 'short',
    });

    const shop = storeName || 'Our Store';
    const receiptNumber = `RCP-${transactionRef.slice(-8).toUpperCase()}`;

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 520px; margin: 0 auto; padding: 20px; background: #ffffff;">
        <!-- Header -->
        <div style="background: linear-gradient(135deg, #10b981, #059669); color: white; padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
          <h1 style="margin: 0 0 4px; font-size: 20px; font-weight: 700;">✅ Payment Confirmed</h1>
          <p style="margin: 0; font-size: 13px; opacity: 0.9;">${shop}</p>
        </div>

        <!-- Body -->
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <!-- Amount Card -->
          <div style="background: white; padding: 20px; border-radius: 10px; border: 1px solid #e2e8f0; text-align: center; margin-bottom: 20px;">
            <p style="margin: 0 0 4px; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px;">Amount Paid</p>
            <p style="margin: 0; font-size: 32px; font-weight: 800; color: #10b981;">${formattedAmount}</p>
          </div>

          <!-- Receipt Details -->
          <div style="background: white; padding: 16px; border-radius: 10px; border: 1px solid #e2e8f0; margin-bottom: 20px;">
            <h3 style="margin: 0 0 12px; font-size: 13px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px;">Receipt Details</h3>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">Receipt No.</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 13px; font-weight: 600; border-bottom: 1px solid #f1f5f9;">${receiptNumber}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">Date</td>
                <td style="padding: 8px 0; text-align: right; font-size: 13px; border-bottom: 1px solid #f1f5f9;">${receiptDate}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">Transaction Ref</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 13px; border-bottom: 1px solid #f1f5f9;">${transactionRef}</td>
              </tr>
              ${utrNumber ? `<tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">UTR Number</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 13px; border-bottom: 1px solid #f1f5f9;">${utrNumber}</td>
              </tr>` : ''}
              ${payerVpa ? `<tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">Paid From (UPI)</td>
                <td style="padding: 8px 0; text-align: right; font-size: 13px; border-bottom: 1px solid #f1f5f9;">${payerVpa}</td>
              </tr>` : ''}
              ${merchantVpa ? `<tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px; border-bottom: 1px solid #f1f5f9;">Paid To (UPI)</td>
                <td style="padding: 8px 0; text-align: right; font-size: 13px; border-bottom: 1px solid #f1f5f9;">${merchantVpa}</td>
              </tr>` : ''}
              ${orderId ? `<tr>
                <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Order ID</td>
                <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 13px;">${orderId}</td>
              </tr>` : ''}
            </table>
          </div>

          <!-- Status Badge -->
          <div style="background: #ecfdf5; border: 2px solid #10b981; padding: 12px; border-radius: 8px; text-align: center; margin-bottom: 20px;">
            <p style="margin: 0; font-size: 14px; font-weight: 700; color: #059669;">✅ PAYMENT VERIFIED</p>
          </div>

          <!-- Footer -->
          <p style="margin: 0; text-align: center; color: #94a3b8; font-size: 11px;">
            This is an auto-generated payment receipt from ${shop}.<br/>
            Please retain this for your records.
          </p>
        </div>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: `${shop} <onboarding@resend.dev>`,
        to: [customerEmail],
        subject: `Payment Receipt: ${formattedAmount} — ${receiptNumber}`,
        html: emailHtml,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', result);
      throw new Error(`Email failed [${res.status}]: ${JSON.stringify(result)}`);
    }

    return new Response(JSON.stringify({ success: true, id: result.id, receiptNumber }), {
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
