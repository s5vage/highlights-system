'use client';

import { isSupabaseConfigured } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import LoginScreen from './LoginScreen';

// Nothing in the app is shown until someone is signed in.
export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { session, loading, recovery } = useAuth();

  if (!isSupabaseConfigured) return <>{children}</>; // the modules show their own "database not connected" message
  if (loading) {
    return (
      <div className="grid min-h-dvh place-items-center" style={{ background: 'var(--bg)' }} aria-busy="true" aria-label="Loading">
        <span className="h-2.5 w-2.5 animate-pulse rounded-full" style={{ background: 'var(--accent)' }} />
      </div>
    );
  }
  if (session && recovery) return <LoginScreen mode="reset" />;
  if (!session) return <LoginScreen />;
  return <>{children}</>;
}