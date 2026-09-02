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

    const { amount, transactionRef, utrNumber, payerVpa, status, adminEmail, verifiedBy } = await req.json();

    if (!amount || !transactionRef || !status) {
      throw new Error('Missing required fields');
    }

    const formattedAmount = new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
    }).format(amount);

    const isVerified = status === 'verified';
    const statusColor = isVerified ? '#10b981' : '#ef4444';
    const statusLabel = isVerified ? '✅ VERIFIED' : '❌ REJECTED';
    const statusEmoji = isVerified ? '✅' : '❌';

    const emailHtml = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: ${statusColor}; color: white; padding: 16px 24px; border-radius: 12px 12px 0 0;">
          <h2 style="margin: 0; font-size: 18px;">${statusEmoji} UPI Payment ${isVerified ? 'Verified' : 'Rejected'}</h2>
        </div>
        <div style="background: #f8fafc; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <div style="background: white; padding: 16px; border-radius: 8px; border: 1px solid #e2e8f0; margin-bottom: 16px;">
            <p style="margin: 0 0 4px; color: #64748b; font-size: 12px;">Amount</p>
            <p style="margin: 0; font-size: 24px; font-weight: 700; color: ${statusColor};">${formattedAmount}</p>
          </div>
          <div style="background: white; padding: 12px 16px; border-radius: 8px; border: 2px solid ${statusColor}; margin-bottom: 16px; text-align: center;">
            <p style="margin: 0; font-size: 16px; font-weight: 700; color: ${statusColor};">${statusLabel}</p>
          </div>
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Transaction Ref</td>
              <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 13px;">${transactionRef}</td>
            </tr>
            ${utrNumber ? `<tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">UTR Number</td>
              <td style="padding: 8px 0; text-align: right; font-family: monospace; font-size: 13px;">${utrNumber}</td>
            </tr>` : ''}
            ${payerVpa ? `<tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Payer VPA</td>
              <td style="padding: 8px 0; text-align: right; font-size: 13px;">${payerVpa}</td>
            </tr>` : ''}
            ${verifiedBy ? `<tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">${isVerified ? 'Verified' : 'Rejected'} By</td>
              <td style="padding: 8px 0; text-align: right; font-size: 13px;">${verifiedBy}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Time</td>
              <td style="padding: 8px 0; text-align: right; font-size: 13px;">${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
            </tr>
          </table>
        </div>
      </div>
    `;

    const toEmail = adminEmail || 'admin@store.com';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Store Payments <onboarding@resend.dev>',
        to: [toEmail],
        subject: `UPI Payment ${isVerified ? 'Verified' : 'Rejected'}: ${formattedAmount}`,
        html: emailHtml,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', result);
      throw new Error(`Email failed [${res.status}]: ${JSON.stringify(result)}`);
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
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
