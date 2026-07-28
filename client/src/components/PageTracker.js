'use client';
import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '../lib/stores/authStore';

export default function PageTracker() {
  const pathname = usePathname();
  const user = useAuthStore((s) => s.user);
  const lastPath = useRef(null);

  useEffect(() => {
    if (pathname === lastPath.current) return;
    lastPath.current = pathname;

    const { protocol, hostname } = window.location;
    const body = { path: pathname };
    if (user?.id) body.userId = user.id;

    fetch(`${protocol}//${hostname}:4000/api/analytics/visit`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    }).catch(() => {});
  }, [pathname, user?.id]);

  return null;
}
