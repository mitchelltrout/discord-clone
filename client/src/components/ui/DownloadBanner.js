'use client';
import { useState, useEffect } from 'react';

const DISMISSED_KEY = 'download_banner_dismissed';

export default function DownloadBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show inside the Electron app
    if (window.electronAPI) return;
    // Only show on Windows
    if (!/Windows/i.test(navigator.userAgent)) return;
    // Don't show if already dismissed
    if (localStorage.getItem(DISMISSED_KEY)) return;
    setVisible(true);
  }, []);

  if (!visible) return null;

  function dismiss() {
    localStorage.setItem(DISMISSED_KEY, '1');
    setVisible(false);
  }

  return (
    <div className="fixed bottom-4 right-4 z-50 flex items-center gap-3 bg-discord-sidebar border border-discord-darker/60 rounded-lg shadow-lg px-4 py-3 max-w-xs text-sm">
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" className="text-discord-blurple shrink-0">
        <path d="M19 9h-4V3H9v6H5l7 7 7-7zm-8 2V5h2v6h1.17L12 13.17 9.83 11H11zm-6 7h14v2H5v-2z"/>
      </svg>
      <span className="text-discord-muted flex-1">
        Get the{' '}
        <a
          href="/downloads/CompuGlobalHyperMegeNet.exe"
          className="text-discord-blurple hover:underline"
        >
          desktop app
        </a>
      </span>
      <button
        onClick={dismiss}
        className="text-discord-muted hover:text-white transition-colors shrink-0"
        title="Dismiss"
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor">
          <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
        </svg>
      </button>
    </div>
  );
}
