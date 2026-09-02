import { useState, useEffect, useCallback } from 'react';
import { Truck, Clock, Loader2, Package, Calendar, CreditCard } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useCurrency } from '@/hooks/useCurrency';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { format } from 'date-fns';

interface ShippingRate {
  id: string;
  mode: string;
  total_amount: number | null;
  estimated_days: string;
  charge_weight: number;
  estimated_delivery_date_min: string | null;
  estimated_delivery_date_max: string | null;
  payment_mode: string;
}

interface DeliveryOption {
  id: string;
  name: string;
  delivery_fee: number;
  estimated_delivery_time: string | null;
  service_areas: string[] | null;
}

interface DeliveryPartnerSelectProps {
  selectedPartnerId: string | null;
  onSelect: (partner: DeliveryOption | null) => void;
  deliveryAddress?: string;
  totalWeightGrams?: number;
  deliveryPincode?: string;
}

function formatDeliveryDate(minDate: string | null, maxDate: string | null): string {
  if (!minDate || !maxDate) return '';
  try {
    const min = new Date(minDate);
    const max = new Date(maxDate);
    const minStr = format(min, 'MMM d');
    const maxStr = format(max, 'MMM d');
    return `${minStr} – ${maxStr}`;
  } catch {
    return '';
  }
}

export function DeliveryPartnerSelect({
  selectedPartnerId,
  onSelect,
  totalWeightGrams = 500,
  deliveryPincode = '',
}: DeliveryPartnerSelectProps) {
  const [rates, setRates] = useState<ShippingRate[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [originPincode, setOriginPincode] = useState('110001');
  const [error, setError] = useState<string | null>(null);
  const [lastFetchKey, setLastFetchKey] = useState('');
  const [paymentMode, setPaymentMode] = useState<'Prepaid' | 'COD'>('Prepaid');
  const { formatCurrency } = useCurrency();

  // Fetch origin pincode from app settings
  useEffect(() => {
    const fetchOrigin = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', 'appSettings')
        .maybeSingle();

      if (data?.value && typeof data.value === 'object' && 'originPincode' in (data.value as Record<string, unknown>)) {
        setOriginPincode((data.value as Record<string, unknown>).originPincode as string);
      }
    };
    fetchOrigin();
  }, []);

  const fetchDelhiveryRates = useCallback(async (pincode: string, mode: 'Prepaid' | 'COD') => {
    if (!pincode || pincode.length !== 6) return;
    const fetchKey = `${pincode}-${mode}`;
    if (fetchKey === lastFetchKey) return;

    setIsFetching(true);
    setError(null);
    setRates([]);
    setLastFetchKey(fetchKey);

    try {
      const { data, error: fnError } = await supabase.functions.invoke('delhivery-shipping-rates', {
        body: {
          origin_pincode: originPincode,
          destination_pincode: pincode,
          weight_grams: totalWeightGrams,
          payment_mode: mode === 'COD' ? 'COD' : 'Prepaid',
        },
      });

      if (fnError) {
        setError('Failed to fetch shipping rates. Please try again.');
        console.error('Edge function error:', fnError);
        return;
      }

      if (data?.error) {
        setError(data.error);
        return;
      }

      if (data?.rates && data.rates.length > 0) {
        const mappedRates: ShippingRate[] = data.rates.map((r: any) => ({
          id: `delhivery-${r.mode.toLowerCase()}`,
          mode: r.mode,
          total_amount: r.total_amount,
          estimated_days: r.estimated_days,
          charge_weight: r.charge_weight,
          estimated_delivery_date_min: r.estimated_delivery_date_min || null,
          estimated_delivery_date_max: r.estimated_delivery_date_max || null,
          payment_mode: r.payment_mode || mode,
        }));
        setRates(mappedRates);

        // Auto-select Express
        const express = mappedRates.find(r => r.mode === 'Express') || mappedRates[0];
        if (express && express.total_amount !== null) {
          onSelect({
            id: express.id,
            name: `Delhivery ${express.mode}`,
            delivery_fee: express.total_amount,
            estimated_delivery_time: formatDeliveryDate(express.estimated_delivery_date_min, express.estimated_delivery_date_max) || express.estimated_days,
            service_areas: null,
          });
        }
      } else {
        setError('No shipping options available for this pincode.');
      }
    } catch (err) {
      console.error('Error:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setIsFetching(false);
    }
  }, [originPincode, totalWeightGrams, onSelect, lastFetchKey]);

  // Auto-fetch when pincode reaches 6 digits or payment mode changes
  useEffect(() => {
    if (deliveryPincode.length === 6) {
      const fetchKey = `${deliveryPincode}-${paymentMode}`;
      if (fetchKey !== lastFetchKey) {
        fetchDelhiveryRates(deliveryPincode, paymentMode);
      }
    } else if (deliveryPincode.length < 6) {
      setRates([]);
      setError(null);
      setLastFetchKey('');
      if (selectedPartnerId) onSelect(null);
    }
  }, [deliveryPincode, paymentMode]);

  const handlePaymentModeChange = (mode: string) => {
    setPaymentMode(mode as 'Prepaid' | 'COD');
    setLastFetchKey(''); // force refetch
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 mb-1">
        <Truck className="w-4 h-4 text-primary" />
        <span className="text-sm font-medium">Shipping via Delhivery</span>
      </div>

      {/* COD / Prepaid Toggle */}
      {deliveryPincode.length === 6 && (
        <Tabs value={paymentMode} onValueChange={handlePaymentModeChange} className="w-full">
          <TabsList className="grid w-full grid-cols-2 h-9">
            <TabsTrigger value="Prepaid" className="text-xs gap-1.5">
              <CreditCard className="w-3 h-3" />
              Prepaid
            </TabsTrigger>
            <TabsTrigger value="COD" className="text-xs gap-1.5">
              <Package className="w-3 h-3" />
              Cash on Delivery
            </TabsTrigger>
          </TabsList>
        </Tabs>
      )}

      {isFetching && (
        <div className="flex items-center gap-2 p-3 bg-secondary/30 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-primary" />
          <span className="text-sm text-muted-foreground">Fetching delivery charges...</span>
        </div>
      )}

      {error && (
        <p className="text-xs text-destructive">{error}</p>
      )}

      {/* Rates */}
      {rates.length > 0 && (
        <RadioGroup
          value={selectedPartnerId || ''}
          onValueChange={(value) => {
            const rate = rates.find(r => r.id === value);
            if (rate && rate.total_amount !== null) {
              onSelect({
                id: rate.id,
                name: `Delhivery ${rate.mode}`,
                delivery_fee: rate.total_amount,
                estimated_delivery_time: formatDeliveryDate(rate.estimated_delivery_date_min, rate.estimated_delivery_date_max) || rate.estimated_days,
                service_areas: null,
              });
            }
          }}
        >
          {rates.map((rate) => {
            const dateRange = formatDeliveryDate(rate.estimated_delivery_date_min, rate.estimated_delivery_date_max);
            return (
              <div
                key={rate.id}
                className={`flex items-center gap-3 p-3 rounded-lg border transition-colors cursor-pointer ${
                  selectedPartnerId === rate.id
                    ? 'border-primary bg-primary/5'
                    : 'border-border hover:border-primary/50'
                }`}
              >
                <RadioGroupItem value={rate.id} id={rate.id} />
                <Label htmlFor={rate.id} className="flex-1 cursor-pointer">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-sm">Delhivery {rate.mode}</p>
                        {rate.mode === 'Express' && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            Fastest
                          </Badge>
                        )}
                        {paymentMode === 'COD' && (
                          <Badge variant="outline" className="text-[10px] px-1.5 py-0 border-accent text-accent-foreground">
                            COD
                          </Badge>
                        )}
                      </div>
                      <div className="flex flex-col gap-1 mt-1">
                        {dateRange && (
                          <span className="flex items-center gap-1 text-xs text-primary font-medium">
                            <Calendar className="w-3 h-3" />
                            Delivery by {dateRange}
                          </span>
                        )}
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {rate.estimated_days}
                          </span>
                          <span className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {rate.charge_weight}g
                          </span>
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-primary">
                        {rate.total_amount !== null ? formatCurrency(rate.total_amount) : 'N/A'}
                      </p>
                    </div>
                  </div>
                </Label>
              </div>
            );
          })}
        </RadioGroup>
      )}

      {!isFetching && rates.length === 0 && !error && deliveryPincode.length < 6 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Enter your delivery pincode above to check shipping charges
        </p>
      )}
    </div>
  );
}
