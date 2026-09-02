import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

declare global {
  interface Window {
    Razorpay: any;
  }
}

interface RazorpayOptions {
  amount: number;
  currency?: string;
  receipt?: string;
  notes?: Record<string, string>;
  customerEmail?: string;
  customerPhone?: string;
  customerName?: string;
  description?: string;
}

interface RazorpayResponse {
  razorpay_order_id: string;
  razorpay_payment_id: string;
  razorpay_signature: string;
}

export function useRazorpay() {
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);

  const loadRazorpayScript = (): Promise<boolean> => {
    return new Promise((resolve) => {
      if (isScriptLoaded || window.Razorpay) {
        setIsScriptLoaded(true);
        resolve(true);
        return;
      }

      const script = document.createElement('script');
      script.src = 'https://checkout.razorpay.com/v1/checkout.js';
      script.onload = () => {
        setIsScriptLoaded(true);
        resolve(true);
      };
      script.onerror = () => {
        console.error('Failed to load Razorpay script');
        resolve(false);
      };
      document.body.appendChild(script);
    });
  };

  const createOrder = async (amount: number, options?: Partial<RazorpayOptions>) => {
    try {
      const { data, error } = await supabase.functions.invoke('razorpay-payment', {
        body: {
          amount,
          currency: options?.currency || 'INR',
          receipt: options?.receipt,
          notes: options?.notes,
        },
      });

      if (error) throw error;

      if (!data?.success) {
        throw new Error(data?.error || 'Failed to create order');
      }

      return {
        orderId: data.order.id,
        keyId: data.key_id,
        amount: data.order.amount,
        currency: data.order.currency,
      };
    } catch (error: any) {
      console.error('Error creating Razorpay order:', error);
      throw error;
    }
  };

  const verifyPayment = async (response: RazorpayResponse) => {
    try {
      const { data, error } = await supabase.functions.invoke('razorpay-payment', {
        body: response,
      });

      if (error) throw error;

      return data?.success === true;
    } catch (error: any) {
      console.error('Error verifying payment:', error);
      return false;
    }
  };

  const initiatePayment = async (
    options: RazorpayOptions,
    onSuccess: (response: RazorpayResponse) => void,
    onError?: (error: any) => void
  ) => {
    setIsLoading(true);

    try {
      // Load Razorpay script
      const scriptLoaded = await loadRazorpayScript();
      if (!scriptLoaded) {
        throw new Error('Failed to load Razorpay');
      }

      // Create order
      const order = await createOrder(options.amount, options);

      // Get stored Razorpay key from localStorage
      const storedKeyId = localStorage.getItem('razorpayKeyId');
      const keyId = order.keyId || storedKeyId;

      if (!keyId) {
        throw new Error('Razorpay not configured. Please add your Razorpay Key ID in Payment Settings.');
      }

      // Configure Razorpay options
      const razorpayOptions = {
        key: keyId,
        amount: order.amount,
        currency: order.currency,
        name: options.description || 'Payment',
        description: options.description || 'Payment',
        order_id: order.orderId,
        prefill: {
          name: options.customerName || '',
          email: options.customerEmail || '',
          contact: options.customerPhone || '',
        },
        notes: options.notes || {},
        theme: {
          color: '#10b981', // Primary color from theme
        },
        handler: async (response: RazorpayResponse) => {
          // Verify payment
          const verified = await verifyPayment(response);
          if (verified) {
            onSuccess(response);
            toast({
              title: 'Payment Successful',
              description: `Payment ID: ${response.razorpay_payment_id}`,
            });
          } else {
            toast({
              title: 'Payment Verification Failed',
              description: 'Please contact support',
              variant: 'destructive',
            });
            onError?.({ message: 'Payment verification failed' });
          }
        },
        modal: {
          ondismiss: () => {
            setIsLoading(false);
            toast({
              title: 'Payment Cancelled',
              description: 'Payment was cancelled by user',
            });
          },
        },
      };

      // Open Razorpay checkout
      const razorpay = new window.Razorpay(razorpayOptions);
      razorpay.on('payment.failed', (response: any) => {
        console.error('Payment failed:', response.error);
        toast({
          title: 'Payment Failed',
          description: response.error.description || 'Payment could not be processed',
          variant: 'destructive',
        });
        onError?.(response.error);
      });

      razorpay.open();
    } catch (error: any) {
      console.error('Error initiating payment:', error);
      toast({
        title: 'Payment Error',
        description: error.message || 'Could not initiate payment',
        variant: 'destructive',
      });
      onError?.(error);
    } finally {
      setIsLoading(false);
    }
  };

  return {
    initiatePayment,
    createOrder,
    verifyPayment,
    isLoading,
    isScriptLoaded,
    loadRazorpayScript,
  };
}
