import { useState, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface UPIPaymentOptions {
  amount: number;
  merchantVPA: string;
  merchantName: string;
  transactionNote?: string;
  transactionRef?: string;
}

interface UPIPaymentResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

// Known UPI business app package names / deep links
const BUSINESS_APP_INTENTS = [
  { name: 'PhonePe Business', scheme: 'phonepe://pay' },
  { name: 'Google Pay Business', scheme: 'gpay://upi/pay' },
  { name: 'Paytm Business', scheme: 'paytmmp://pay' },
  { name: 'BharatPe', scheme: 'bharatpe://pay' },
];

export function useUPIPayment() {
  const [isProcessing, setIsProcessing] = useState(false);
  const { toast } = useToast();

  const isMobileDevice = useCallback(() => {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent
    );
  }, []);

  const generateUPILink = useCallback((options: UPIPaymentOptions) => {
    const {
      amount,
      merchantVPA,
      merchantName,
      transactionNote = 'Payment',
      transactionRef = Date.now().toString(),
    } = options;

    const upiUrl = new URL('upi://pay');
    upiUrl.searchParams.set('pa', merchantVPA);
    upiUrl.searchParams.set('pn', merchantName);
    upiUrl.searchParams.set('am', amount.toFixed(2));
    upiUrl.searchParams.set('cu', 'INR');
    upiUrl.searchParams.set('tn', transactionNote);
    upiUrl.searchParams.set('tr', transactionRef);

    return upiUrl.toString();
  }, []);

  const generateUPICollectLink = useCallback((options: UPIPaymentOptions & { payerVPA?: string }) => {
    const {
      amount,
      merchantVPA,
      merchantName,
      transactionNote = 'Payment Verification',
      transactionRef = Date.now().toString(),
      payerVPA,
    } = options;

    const upiUrl = new URL('upi://pay');
    upiUrl.searchParams.set('pa', merchantVPA);
    upiUrl.searchParams.set('pn', merchantName);
    upiUrl.searchParams.set('am', amount.toFixed(2));
    upiUrl.searchParams.set('cu', 'INR');
    upiUrl.searchParams.set('tn', transactionNote);
    upiUrl.searchParams.set('tr', transactionRef);
    if (payerVPA) {
      upiUrl.searchParams.set('pa', payerVPA);
    }
    upiUrl.searchParams.set('mode', '04');

    return upiUrl.toString();
  }, []);

  const initiateUPIPayment = useCallback(async (
    options: UPIPaymentOptions
  ): Promise<UPIPaymentResult> => {
    setIsProcessing(true);

    try {
      const upiLink = generateUPILink(options);

      if (isMobileDevice()) {
        const link = document.createElement('a');
        link.href = upiLink;
        link.click();

        toast({
          title: 'UPI App Opened',
          description: 'Please complete the payment in your UPI app and confirm below.',
        });

        return {
          success: true,
          transactionId: options.transactionRef,
        };
      } else {
        toast({
          title: 'UPI Payment',
          description: 'Please scan the QR code with your UPI app to complete payment.',
        });

        return {
          success: true,
          transactionId: options.transactionRef,
        };
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Payment failed';
      toast({
        title: 'Payment Error',
        description: errorMessage,
        variant: 'destructive',
      });

      return {
        success: false,
        error: errorMessage,
      };
    } finally {
      setIsProcessing(false);
    }
  }, [generateUPILink, toast, isMobileDevice]);

  // Try to open specific business apps, falling back to generic UPI intent
  const openBusinessApp = useCallback((options: {
    merchantVPA: string;
    merchantName: string;
    amount: number;
    transactionRef: string;
  }) => {
    if (!isMobileDevice()) {
      toast({
        title: 'Open UPI App on Phone',
        description: 'Open your UPI business app on your phone to verify the payment.',
      });
      return;
    }

    // Build the standard UPI intent URL
    const params = new URLSearchParams({
      pa: options.merchantVPA,
      pn: options.merchantName,
      am: options.amount.toFixed(2),
      cu: 'INR',
      tn: `Verify: ${options.transactionRef}`,
      tr: options.transactionRef,
    });

    // Try the generic UPI intent — the OS will show all installed UPI apps
    // including business variants (PhonePe Business, GPay Business, etc.)
    const upiUrl = `upi://pay?${params.toString()}`;
    
    const link = document.createElement('a');
    link.href = upiUrl;
    link.click();

    toast({
      title: 'UPI Business App Opening',
      description: 'Check your UPI business app to verify the received payment. Come back and confirm once verified.',
    });
  }, [toast, isMobileDevice]);

  const getQRCodeUrl = useCallback((options: UPIPaymentOptions) => {
    const upiLink = generateUPILink(options);
    return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(upiLink)}`;
  }, [generateUPILink]);

  return {
    initiateUPIPayment,
    generateUPILink,
    generateUPICollectLink,
    getQRCodeUrl,
    openBusinessApp,
    isProcessing,
    isMobileDevice,
  };
}
