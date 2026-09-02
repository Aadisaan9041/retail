import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const DEFAULT_NAME = 'My Store';
const DEFAULT_TAGLINE = 'Point of Sale';

export function useStoreName() {
  const [storeName, setStoreName] = useState(DEFAULT_NAME);
  const [tagline, setTagline] = useState(DEFAULT_TAGLINE);

  useEffect(() => {
    const fetchName = async () => {
      const { data } = await supabase
        .from('app_settings')
        .select('key, value')
        .in('key', ['appSettings', 'webstoreSettings']);

      if (data && data.length > 0) {
        const app = (data.find(r => r.key === 'appSettings')?.value ?? {}) as Record<string, string>;
        const web = (data.find(r => r.key === 'webstoreSettings')?.value ?? {}) as Record<string, string>;
        const name = web.storeName || app.appName;
        if (name && name.trim()) setStoreName(name.trim());
      }
    };
    fetchName();
  }, []);

  return { storeName, tagline };
}
