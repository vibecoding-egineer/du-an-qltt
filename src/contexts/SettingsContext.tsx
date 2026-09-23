import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { auth } from '../lib/firebase';

interface Settings {
  id?: number;
  tenantId: string;
  centerName: string;
  logoUrl: string | null;
}

interface SettingsContextType {
  settings: Settings | null;
  loading: boolean;
  refreshSettings: () => Promise<void>;
  updateSettings: (centerName: string, logoUrl: string | null) => Promise<void>;
}

const SettingsContext = createContext<SettingsContextType>({} as SettingsContextType);

export function SettingsProvider({ children }: { children: React.ReactNode }) {
  const { user, dbUser, loading: authLoading } = useAuth();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSettings = async () => {
    if (!user || !dbUser) {
      setSettings(null);
      setLoading(false);
      return;
    }
    try {
      const token = await user.getIdToken();
      const res = await fetch('/api/settings', {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.ok) {
        const data = await res.json();
        setSettings(data);
      }
    } catch (err) {
      console.error("Failed to fetch settings", err);
    } finally {
      setLoading(false);
    }
  };

  const updateSettings = async (centerName: string, logoUrl: string | null) => {
    if (!user) return;
    const token = await user.getIdToken();
    const res = await fetch('/api/settings', {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ centerName, logoUrl })
    });
    if (res.ok) {
      const data = await res.json();
      setSettings(data);
    } else {
      throw new Error("Failed to update settings");
    }
  };

  useEffect(() => {
    if (!authLoading) {
      refreshSettings();
    }
  }, [user, dbUser, authLoading]);

  return (
    <SettingsContext.Provider value={{ settings, loading, refreshSettings, updateSettings }}>
      {children}
    </SettingsContext.Provider>
  );
}

export const useSettings = () => useContext(SettingsContext);
