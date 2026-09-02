import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface PaymentConfig {
  storefrontUpiId: string;
  storefrontUpiName: string;
  posUpiId: string;
  posUpiName: string;
  enableRazorpay: boolean;
  enablePayU: boolean;
  enableUPI: boolean;
  enableCash: boolean;
  enableCard: boolean;
}

const defaults: PaymentConfig = {
  storefrontUpiId: '',
  storefrontUpiName: '',
  posUpiId: '',
  posUpiName: '',
  enableRazorpay: true,
  enablePayU: false,
  enableUPI: true,
  enableCash: true,
  enableCard: true,
};

export function usePaymentConfig() {
  const [config, setConfig] = useState<PaymentConfig>(defaults);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        const { data } = await supabase
          .from('app_settings')
          .select('key, value')
          .in('key', ['paymentSettings', 'posSettings']);

        if (data) {
          let merged = { ...defaults };
          for (const row of data) {
            const v = row.value as Record<string, unknown> | null;
            if (!v) continue;
            if (row.key === 'paymentSettings') {
              if (typeof v.storefrontUpiId === 'string') merged.storefrontUpiId = v.storefrontUpiId;
              if (typeof v.storefrontUpiName === 'string') merged.storefrontUpiName = v.storefrontUpiName;
              if (typeof v.enableRazorpay === 'boolean') merged.enableRazorpay = v.enableRazorpay;
              if (typeof v.enablePayU === 'boolean') merged.enablePayU = v.enablePayU;
              if (typeof v.enableUPI === 'boolean') merged.enableUPI = v.enableUPI;
              if (typeof v.enableCash === 'boolean') merged.enableCash = v.enableCash;
              if (typeof v.enableCard === 'boolean') merged.enableCard = v.enableCard;
            }
            if (row.key === 'posSettings') {
              if (typeof v.posUpiId === 'string') merged.posUpiId = v.posUpiId;
              if (typeof v.posUpiName === 'string') merged.posUpiName = v.posUpiName;
            }
          }
          setConfig(merged);
        }
      } catch (err) {
        console.error('Error fetching payment config:', err);
      } finally {
        setIsLoading(false);
      }
    };
    fetchAll();
  }, []);

  return { config, isLoading };
}
