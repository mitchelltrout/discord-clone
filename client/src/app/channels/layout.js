'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../lib/stores/authStore';
import { connectSocket } from '../../lib/socket';
import AppShell from '../../components/layout/AppShell';

export default function ChannelsLayout({ children }) {
  const router = useRouter();
  const { user, accessToken, _hasHydrated } = useAuthStore();

  // Connect synchronously so the socket exists before child effects run.
  // connectSocket is idempotent — safe to call on every render.
  if (typeof window !== 'undefined' && user && accessToken) {
    connectSocket(accessToken);
  }

  useEffect(() => {
    if (!_hasHydrated) return;
    if (!user || !accessToken) {
      router.replace('/login');
    }
  }, [user, accessToken, _hasHydrated, router]);

  if (!_hasHydrated || !user) return null;

  return <AppShell>{children}</AppShell>;
}
