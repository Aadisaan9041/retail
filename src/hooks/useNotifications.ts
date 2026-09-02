import { useState, useEffect, useCallback } from 'react';
import { useToast } from '@/hooks/use-toast';

interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
  tag?: string;
  data?: any;
}

export function useNotifications() {
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [isSupported, setIsSupported] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if ('Notification' in window) {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  const requestPermission = useCallback(async (): Promise<boolean> => {
    if (!isSupported) {
      toast({
        title: 'Not Supported',
        description: 'Push notifications are not supported in this browser',
        variant: 'destructive',
      });
      return false;
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      
      if (result === 'granted') {
        toast({
          title: 'Notifications Enabled',
          description: 'You will now receive stock alerts',
        });
        return true;
      } else {
        toast({
          title: 'Notifications Blocked',
          description: 'Please enable notifications in your browser settings',
          variant: 'destructive',
        });
        return false;
      }
    } catch (error) {
      console.error('Error requesting notification permission:', error);
      return false;
    }
  }, [isSupported, toast]);

  const showNotification = useCallback((options: NotificationOptions) => {
    if (!isSupported || permission !== 'granted') {
      // Fallback to toast
      toast({
        title: options.title,
        description: options.body,
      });
      return null;
    }

    try {
      const notification = new Notification(options.title, {
        body: options.body,
        icon: options.icon || '/favicon.ico',
        tag: options.tag,
        data: options.data,
        requireInteraction: true,
      });

      notification.onclick = () => {
        window.focus();
        notification.close();
      };

      return notification;
    } catch (error) {
      console.error('Error showing notification:', error);
      // Fallback to toast
      toast({
        title: options.title,
        description: options.body,
      });
      return null;
    }
  }, [isSupported, permission, toast]);

  const showLowStockAlert = useCallback((productName: string, quantity: number) => {
    return showNotification({
      title: '⚠️ Low Stock Alert',
      body: `${productName} is running low (${quantity} left)`,
      tag: `low-stock-${productName}`,
    });
  }, [showNotification]);

  const showOutOfStockAlert = useCallback((productName: string) => {
    return showNotification({
      title: '🚨 Out of Stock',
      body: `${productName} is now out of stock!`,
      tag: `out-of-stock-${productName}`,
    });
  }, [showNotification]);

  const showReorderAlert = useCallback((productName: string, quantity: number) => {
    return showNotification({
      title: '📦 Reorder Created',
      body: `Auto-reorder for ${productName} (${quantity} units) has been created`,
      tag: `reorder-${productName}`,
    });
  }, [showNotification]);

  return {
    isSupported,
    permission,
    requestPermission,
    showNotification,
    showLowStockAlert,
    showOutOfStockAlert,
    showReorderAlert,
  };
}
