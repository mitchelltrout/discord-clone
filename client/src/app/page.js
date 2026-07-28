'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../lib/stores/authStore';

export default function Home() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const hasHydrated = useAuthStore((s) => s._hasHydrated);

  useEffect(() => {
    if (!hasHydrated) return;
    if (user) {
      router.replace('/channels/me');
    } else {
      router.replace('/login');
    }
  }, [user, hasHydrated, router]);

  return null;
}
