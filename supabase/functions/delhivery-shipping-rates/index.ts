import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Add business days to a date (skip weekends)
function addBusinessDays(startDate: Date, days: number): Date {
  const result = new Date(startDate);
  let added = 0;
  while (added < days) {
    result.setDate(result.getDate() + 1);
    const dow = result.getDay();
    if (dow !== 0 && dow !== 6) added++;
  }
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const DELHIVERY_API_TOKEN = Deno.env.get('DELHIVERY_API_TOKEN');
    if (!DELHIVERY_API_TOKEN) {
      throw new Error('DELHIVERY_API_TOKEN is not configured');
    }

    const { origin_pincode, destination_pincode, weight_grams, payment_mode } = await req.json();

    if (!origin_pincode || !destination_pincode || !weight_grams) {
      return new Response(
        JSON.stringify({ error: 'origin_pincode, destination_pincode, and weight_grams are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const isCOD = payment_mode === 'COD';
    const baseUrl = 'https://track.delhivery.com/api/kinko/v1/invoice/charges/.json';

    // Build query params - add pt=Pre-paid or pt=COD
    const ptParam = isCOD ? '&pt=COD' : '&pt=Pre-paid';

    // Fetch both Express and Surface rates in parallel
    const [expressRes, surfaceRes] = await Promise.all([
      fetch(
        `${baseUrl}?md=E&cgm=${weight_grams}&o_pin=${origin_pincode}&d_pin=${destination_pincode}&ss=Delivered${ptParam}`,
        {
          headers: {
            'Authorization': `Token ${DELHIVERY_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      ),
      fetch(
        `${baseUrl}?md=S&cgm=${weight_grams}&o_pin=${origin_pincode}&d_pin=${destination_pincode}&ss=Delivered${ptParam}`,
        {
          headers: {
            'Authorization': `Token ${DELHIVERY_API_TOKEN}`,
            'Content-Type': 'application/json',
          },
        }
      ),
    ]);

    const expressData = await expressRes.json();
    const surfaceData = await surfaceRes.json();

    const now = new Date();
    const rates = [];

    if (expressRes.ok && expressData && !expressData.error) {
      const minDays = 2;
      const maxDays = 4;
      rates.push({
        mode: 'Express',
        total_amount: expressData[0]?.total_amount ?? null,
        charge_weight: expressData[0]?.charge_weight ?? weight_grams,
        estimated_days: `${minDays}-${maxDays} business days`,
        estimated_delivery_date_min: addBusinessDays(now, minDays).toISOString(),
        estimated_delivery_date_max: addBusinessDays(now, maxDays).toISOString(),
        payment_mode: isCOD ? 'COD' : 'Prepaid',
        raw: expressData[0] || expressData,
      });
    }

    if (surfaceRes.ok && surfaceData && !surfaceData.error) {
      const minDays = 5;
      const maxDays = 7;
      rates.push({
        mode: 'Surface',
        total_amount: surfaceData[0]?.total_amount ?? null,
        charge_weight: surfaceData[0]?.charge_weight ?? weight_grams,
        estimated_days: `${minDays}-${maxDays} business days`,
        estimated_delivery_date_min: addBusinessDays(now, minDays).toISOString(),
        estimated_delivery_date_max: addBusinessDays(now, maxDays).toISOString(),
        payment_mode: isCOD ? 'COD' : 'Prepaid',
        raw: surfaceData[0] || surfaceData,
      });
    }

    if (rates.length === 0) {
      return new Response(
        JSON.stringify({
          error: 'Unable to fetch shipping rates. Pincode may not be serviceable.',
          express_error: expressData,
          surface_error: surfaceData,
        }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({ rates, origin_pincode, destination_pincode, weight_grams, payment_mode: isCOD ? 'COD' : 'Prepaid' }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error fetching Delhivery rates:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
