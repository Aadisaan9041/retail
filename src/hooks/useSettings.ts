import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import type { Json } from '@/integrations/supabase/types';

type SettingsShape = object;

const safeParseSettings = <T extends SettingsShape>(raw: string | null, fallback: T): T => {
  if (!raw) return fallback;

  try {
    const parsed = JSON.parse(raw) as Partial<T>;
    return { ...(fallback as Record<string, unknown>), ...(parsed as Record<string, unknown>) } as T;
  } catch (error) {
    console.error('Error parsing saved settings:', error);
    return fallback;
  }
};

export function useSettings<T extends SettingsShape>(
  settingsKey: string,
  defaultValue: T
) {
  const [settings, setSettings] = useState<T>(defaultValue);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const { toast } = useToast();

  const saveToDatabase = useCallback(async (value: T) => {
    try {
      const { error } = await supabase
        .from('app_settings')
        .upsert(
          { key: settingsKey, value: value as unknown as Json },
          { onConflict: 'key' }
        );

      if (error) {
        console.error('Error saving to database:', error);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error in saveToDatabase:', err);
      return false;
    }
  }, [settingsKey]);

  const fetchSettings = useCallback(async () => {
    setIsLoading(true);

    try {
      const { data, error } = await supabase
        .from('app_settings')
        .select('value')
        .eq('key', settingsKey)
        .maybeSingle();

      if (error) {
        console.error('Error fetching settings:', error);
        setSettings(safeParseSettings(localStorage.getItem(settingsKey), defaultValue));
        return;
      }

      if (data?.value && typeof data.value === 'object' && data.value !== null) {
        const merged = { ...defaultValue, ...(data.value as Partial<T>) };
        setSettings(merged as T);
        localStorage.setItem(settingsKey, JSON.stringify(merged));
        return;
      }

      const migrated = safeParseSettings(localStorage.getItem(settingsKey), defaultValue);
      setSettings(migrated);

      if (JSON.stringify(migrated) !== JSON.stringify(defaultValue)) {
        await saveToDatabase(migrated);
      }
    } catch (err) {
      console.error('Error in fetchSettings:', err);
      setSettings(safeParseSettings(localStorage.getItem(settingsKey), defaultValue));
    } finally {
      setIsLoading(false);
    }
  }, [defaultValue, saveToDatabase, settingsKey]);

  const saveSettings = useCallback(async (newSettings: T) => {
    setIsSaving(true);

    try {
      localStorage.setItem(settingsKey, JSON.stringify(newSettings));
      setSettings(newSettings);

      const success = await saveToDatabase(newSettings);

      toast({
        title: success ? 'Settings Saved' : 'Settings Saved Locally',
        description: success
          ? 'Your settings have been saved successfully.'
          : 'Settings saved in browser backup. Backend sync will retry next time.',
      });
    } catch (err) {
      console.error('Error saving settings:', err);
      toast({
        title: 'Error',
        description: 'Failed to save settings.',
        variant: 'destructive',
      });
    } finally {
      setIsSaving(false);
    }
  }, [saveToDatabase, settingsKey, toast]);

  const updateField = useCallback(<K extends keyof T>(field: K, value: T[K]) => {
    setSettings((prev) => ({ ...prev, [field]: value }));
  }, []);

  useEffect(() => {
    fetchSettings();
  }, [fetchSettings]);

  return {
    settings,
    setSettings,
    updateField,
    saveSettings,
    isLoading,
    isSaving,
    refetch: fetchSettings,
  };
}
