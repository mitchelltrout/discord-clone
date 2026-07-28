'use client';
import { useConnectionStore } from '../../lib/stores/connectionStore';

export default function ConnectionBanner() {
  const status = useConnectionStore((s) => s.status);
  if (status === 'connected') return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center gap-3 px-4 py-2 bg-yellow-600 text-white text-sm font-medium shadow-lg">
      <svg className="animate-spin shrink-0" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
      </svg>
      {status === 'reconnecting'
        ? 'Connection lost — reconnecting...'
        : 'Could not reconnect. Redirecting to login...'}
    </div>
  );
}
