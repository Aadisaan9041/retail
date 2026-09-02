import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface PayUConfig {
  merchantKey: string;
  salt: string;
  testMode?: boolean;
}

interface PaymentData {
  amount: number;
  productInfo: string;
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  transactionId?: string;
  successUrl?: string;
  failureUrl?: string;
}

interface PayUResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

// PayU payment form URL
const PAYU_BASE_URL_TEST = 'https://test.payu.in/_payment';
const PAYU_BASE_URL_PROD = 'https://secure.payu.in/_payment';

export function usePayU() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  // Generate SHA-512 hash for PayU
  const generateHash = async (
    key: string,
    txnId: string,
    amount: string,
    productInfo: string,
    firstName: string,
    email: string,
    salt: string
  ): Promise<string> => {
    const hashString = `${key}|${txnId}|${amount}|${productInfo}|${firstName}|${email}|||||||||||${salt}`;
    const encoder = new TextEncoder();
    const data = encoder.encode(hashString);
    const hashBuffer = await crypto.subtle.digest('SHA-512', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  };

  const initiatePayment = useCallback(async (
    config: PayUConfig,
    paymentData: PaymentData
  ): Promise<PayUResult> => {
    setIsProcessing(true);

    try {
      const txnId = paymentData.transactionId || `TXN${Date.now()}`;
      const amount = paymentData.amount.toFixed(2);
      
      // Generate hash
      const hash = await generateHash(
        config.merchantKey,
        txnId,
        amount,
        paymentData.productInfo,
        paymentData.customerName,
        paymentData.customerEmail,
        config.salt
      );

      // Create form and submit
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = config.testMode ? PAYU_BASE_URL_TEST : PAYU_BASE_URL_PROD;

      const fields = {
        key: config.merchantKey,
        txnid: txnId,
        amount: amount,
        productinfo: paymentData.productInfo,
        firstname: paymentData.customerName,
        email: paymentData.customerEmail,
        phone: paymentData.customerPhone,
        surl: paymentData.successUrl || window.location.origin + '/payment-success',
        furl: paymentData.failureUrl || window.location.origin + '/payment-failure',
        hash: hash,
      };

      Object.entries(fields).forEach(([name, value]) => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = name;
        input.value = value;
        form.appendChild(input);
      });

      document.body.appendChild(form);
      form.submit();

      return {
        success: true,
        transactionId: txnId,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment initiation failed';
      toast({
        title: 'Payment Error',
        description: errorMessage,
        variant: 'destructive',
      });

      setIsProcessing(false);
      return {
        success: false,
        error: errorMessage,
      };
    }
  }, [toast]);

  // Simulate PayU payment for demo (opens modal instead of redirect)
  const simulatePayment = useCallback(async (
    paymentData: PaymentData
  ): Promise<PayUResult> => {
    setIsProcessing(true);

    return new Promise((resolve) => {
      // Simulate payment processing
      setTimeout(() => {
        setIsProcessing(false);
        toast({
          title: 'Payment Successful',
          description: `Transaction ID: TXN${Date.now()}`,
        });
        resolve({
          success: true,
          transactionId: `TXN${Date.now()}`,
        });
      }, 2000);
    });
  }, [toast]);

  return {
    initiatePayment,
    simulatePayment,
    isProcessing,
  };
}
