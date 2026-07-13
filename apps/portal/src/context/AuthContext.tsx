'use client';
import React, { createContext, useContext, useState } from 'react';

export type VendorTrack = 'play' | 'pass';

interface AuthContextType {
  vendorId: string;
  vendorName: string;
  track: VendorTrack;
  switchVendor: (id: string, name: string, track: VendorTrack) => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

// Mock vendors for dev
const MOCK_VENDORS = [
  { id: 'vendor-play-001', name: 'SportZone Courts', track: 'play' as VendorTrack },
  { id: 'vendor-pass-001', name: 'FitLife Studio', track: 'pass' as VendorTrack },
];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [vendor, setVendor] = useState(MOCK_VENDORS[0]);

  const switchVendor = (id: string, name: string, track: VendorTrack) =>
    setVendor({ id, name, track });

  return (
    <AuthContext.Provider value={{ vendorId: vendor.id, vendorName: vendor.name, track: vendor.track, switchVendor }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}

export { MOCK_VENDORS };
