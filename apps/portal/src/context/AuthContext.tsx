'use client';
import React, { createContext, useContext, useState, useEffect } from 'react';

export type VendorTrack = 'play' | 'pass';

export interface VendorData {
  id: string;
  name: string;
  track: VendorTrack;
  staffId: string;
}

interface AuthContextType {
  vendorId: string;
  vendorName: string;
  track: VendorTrack;
  staffId: string;
  vendors: VendorData[];
  switchVendor: (id: string, name: string, track: VendorTrack, staffId: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [vendors, setVendors] = useState<VendorData[]>([]);
  const [vendor, setVendor] = useState<VendorData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/auth/context')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load vendor list (${res.status})`);
        return res.json();
      })
      .then(data => {
        if (data && data.length > 0) {
          setVendors(data);
          setVendor(data[0]);
        } else {
          setError('No vendors found. Run the seed script: pnpm seed');
        }
      })
      .catch(err => {
        console.error('Failed to load vendors', err);
        setError('Could not load vendor list. Is the database running and seeded?');
      })
      .finally(() => setIsLoading(false));
  }, []);

  const switchVendor = (id: string, name: string, track: VendorTrack, staffId: string) =>
    setVendor({ id, name, track, staffId });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', color: '#666' }}>
        Loading workspace…
      </div>
    );
  }

  if (error || !vendor) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', fontFamily: 'sans-serif', gap: '12px' }}>
        <span style={{ fontSize: '2rem' }}>⚠️</span>
        <p style={{ color: '#c0392b', fontWeight: 600 }}>{error ?? 'No vendor data found.'}</p>
        <code style={{ background: '#f4f4f4', padding: '4px 10px', borderRadius: 4, fontSize: '0.85rem' }}>pnpm seed</code>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={{
      vendorId: vendor.id,
      vendorName: vendor.name,
      track: vendor.track,
      staffId: vendor.staffId,
      vendors,
      switchVendor,
      isLoading
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
