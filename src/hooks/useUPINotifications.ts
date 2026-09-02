import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface NotificationOptions {
  adminEmail?: string;
}

/**
 * Hook that listens for new UPI payment verification requests via Realtime
 * and shows browser notifications to admins.
 */
export function useUPINotifications(enabled: boolean = true, options?: NotificationOptions) {
  const { toast } = useToast();
  const permissionGranted = useRef(false);

  // Request notification permission on mount
  useEffect(() => {
    if (!enabled) return;
    if ('Notification' in window) {
      if (Notification.permission === 'granted') {
        permissionGranted.current = true;
      } else if (Notification.permission !== 'denied') {
        Notification.requestPermission().then((permission) => {
          permissionGranted.current = permission === 'granted';
        });
      }
    }
  }, [enabled]);

  // Listen for new pending UPI verifications
  useEffect(() => {
    if (!enabled) return;

    const channel = supabase
      .channel('upi-notifications')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'upi_payment_verifications',
          filter: 'status=eq.pending',
        },
        (payload) => {
          const record = payload.new as {
            amount: number;
            transaction_ref: string;
            utr_number: string | null;
            payer_vpa: string | null;
          };

          const amount = new Intl.NumberFormat('en-IN', {
            style: 'currency',
            currency: 'INR',
          }).format(record.amount);

          // In-app toast
          toast({
            title: '🔔 New UPI Payment',
            description: `${amount} received — UTR: ${record.utr_number || 'N/A'}. Tap to verify.`,
          });

          // Browser push notification (works when PWA is installed)
          if (permissionGranted.current && 'Notification' in window) {
            try {
              new Notification('New UPI Payment Received', {
                body: `${amount} — Ref: ${record.transaction_ref}\nUTR: ${record.utr_number || 'Pending'}`,
                icon: '/pwa-192x192.png',
                badge: '/pwa-192x192.png',
                tag: `upi-${record.transaction_ref}`,
                requireInteraction: true,
              });
            } catch {
              // Notification constructor may fail in some contexts
            }
          }

          // Send email alert via edge function
          supabase.functions.invoke('upi-payment-alert', {
            body: {
              amount: record.amount,
              transactionRef: record.transaction_ref,
              utrNumber: record.utr_number,
              payerVpa: record.payer_vpa,
              adminEmail: options?.adminEmail,
            },
          }).catch((err) => console.error('Email alert failed:', err));
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [enabled, toast, options?.adminEmail]);
}
