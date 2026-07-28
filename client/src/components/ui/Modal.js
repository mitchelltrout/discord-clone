'use client';
import { useEffect } from 'react';

export default function Modal({ onClose, title, children }) {
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 bg-black/70 flex items-center justify-center z-50"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-discord-sidebar rounded-lg w-full max-w-md shadow-2xl">
        {title && (
          <div className="px-6 pt-6 pb-4 border-b border-discord-darker/50">
            <h2 className="text-xl font-bold text-white">{title}</h2>
          </div>
        )}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
