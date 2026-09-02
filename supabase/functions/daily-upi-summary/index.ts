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
    const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY');
    if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY is not configured');

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get payments from the last 24 hours
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: payments, error } = await supabase
      .from('upi_payment_verifications')
      .select('*')
      .gte('created_at', since)
      .order('created_at', { ascending: false });

    if (error) throw error;

    const all = payments || [];
    const verified = all.filter(p => p.status === 'verified');
    const pending = all.filter(p => p.status === 'pending');
    const rejected = all.filter(p => p.status === 'rejected');

    const totalAmount = all.reduce((s, p) => s + Number(p.amount), 0);
    const verifiedAmount = verified.reduce((s, p) => s + Number(p.amount), 0);

    const fmt = (n: number) =>
      new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' }).format(n);

    const rowsHtml = all.length === 0
      ? '<tr><td colspan="5" style="padding:12px;text-align:center;color:#94a3b8;">No UPI payments in the last 24 hours</td></tr>'
      : all.map(p => `
        <tr style="border-bottom:1px solid #e2e8f0;">
          <td style="padding:8px 12px;font-size:13px;">${new Date(p.created_at).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}</td>
          <td style="padding:8px 12px;font-size:13px;font-family:monospace;">${p.utr_number || p.transaction_ref}</td>
          <td style="padding:8px 12px;font-size:13px;font-weight:600;">${fmt(p.amount)}</td>
          <td style="padding:8px 12px;font-size:13px;">${p.payer_vpa || '-'}</td>
          <td style="padding:8px 12px;font-size:13px;">
            <span style="padding:2px 8px;border-radius:12px;font-size:11px;font-weight:600;background:${
              p.status === 'verified' ? '#dcfce7;color:#166534' :
              p.status === 'rejected' ? '#fef2f2;color:#991b1b' :
              '#fef9c3;color:#854d0e'
            }">${p.status.toUpperCase()}</span>
          </td>
        </tr>
      `).join('');

    const emailHtml = `
      <div style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:640px;margin:0 auto;padding:20px;">
        <div style="background:linear-gradient(135deg,#6366f1,#8b5cf6);color:white;padding:20px 24px;border-radius:12px 12px 0 0;">
          <h2 style="margin:0;font-size:18px;">📊 Daily UPI Payment Summary</h2>
          <p style="margin:4px 0 0;opacity:0.9;font-size:13px;">${new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric', timeZone: 'Asia/Kolkata' })}</p>
        </div>
        <div style="background:#f8fafc;padding:24px;border:1px solid #e2e8f0;border-top:none;">
          <div style="display:flex;gap:12px;margin-bottom:20px;">
            <div style="flex:1;background:white;padding:14px;border-radius:8px;border:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#64748b;text-transform:uppercase;">Total</p>
              <p style="margin:4px 0 0;font-size:22px;font-weight:700;">${all.length}</p>
              <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${fmt(totalAmount)}</p>
            </div>
            <div style="flex:1;background:white;padding:14px;border-radius:8px;border:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#16a34a;text-transform:uppercase;">Verified</p>
              <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#16a34a;">${verified.length}</p>
              <p style="margin:2px 0 0;font-size:12px;color:#64748b;">${fmt(verifiedAmount)}</p>
            </div>
            <div style="flex:1;background:white;padding:14px;border-radius:8px;border:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#ca8a04;text-transform:uppercase;">Pending</p>
              <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#ca8a04;">${pending.length}</p>
            </div>
            <div style="flex:1;background:white;padding:14px;border-radius:8px;border:1px solid #e2e8f0;text-align:center;">
              <p style="margin:0;font-size:11px;color:#dc2626;text-transform:uppercase;">Rejected</p>
              <p style="margin:4px 0 0;font-size:22px;font-weight:700;color:#dc2626;">${rejected.length}</p>
            </div>
          </div>

          <table style="width:100%;border-collapse:collapse;background:white;border-radius:8px;border:1px solid #e2e8f0;overflow:hidden;">
            <thead>
              <tr style="background:#f1f5f9;">
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Date</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">UTR/Ref</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Amount</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Payer</th>
                <th style="padding:10px 12px;text-align:left;font-size:11px;color:#64748b;text-transform:uppercase;">Status</th>
              </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
          </table>

          ${pending.length > 0 ? `
          <div style="margin-top:16px;padding:12px;background:#fef3c7;border-radius:8px;border:1px solid #fcd34d;">
            <p style="margin:0;font-size:13px;color:#92400e;">
              ⚠️ ${pending.length} payment(s) still pending verification. Please review them in the admin panel.
            </p>
          </div>` : ''}
        </div>
        <div style="padding:16px 24px;background:#f1f5f9;border-radius:0 0 12px 12px;border:1px solid #e2e8f0;border-top:none;">
          <p style="margin:0;font-size:11px;color:#94a3b8;text-align:center;">
            This is an automated daily summary. Generated at ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}.
          </p>
        </div>
      </div>
    `;

    // Get admin email from request body or use default
    const body = await req.json().catch(() => ({}));
    const toEmail = body.adminEmail || 'admin@store.com';

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${RESEND_API_KEY}`,
      },
      body: JSON.stringify({
        from: 'Store Reports <onboarding@resend.dev>',
        to: [toEmail],
        subject: `Daily UPI Summary: ${all.length} payments, ${fmt(verifiedAmount)} verified — ${new Date().toLocaleDateString('en-IN')}`,
        html: emailHtml,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      console.error('Resend API error:', result);
      throw new Error(`Email failed [${res.status}]: ${JSON.stringify(result)}`);
    }

    return new Response(JSON.stringify({ success: true, id: result.id, stats: { total: all.length, verified: verified.length, pending: pending.length, rejected: rejected.length } }), {
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
