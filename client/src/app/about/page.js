'use client';
import { useRouter } from 'next/navigation';

const APP_VERSION = '1.0.0';

const CLIENT_DEPS = [
  { name: 'Next.js',         version: '14.2.3' },
  { name: 'React',           version: '18' },
  { name: 'Socket.io Client',version: '4.7.5' },
  { name: 'Zustand',         version: '4.5.2' },
  { name: 'simple-peer',     version: '9.11.1' },
  { name: 'Axios',           version: '1.6.8' },
  { name: 'date-fns',        version: '3.6.0' },
  { name: 'Tailwind CSS',    version: '3.4.3' },
  { name: 'emoji-mart',      version: '1.2.1' },
];

const SERVER_DEPS = [
  { name: 'Node.js',            version: process.version ?? 'unknown' },
  { name: 'Express',            version: '4.19.2' },
  { name: 'Socket.io',          version: '4.7.5' },
  { name: 'jsonwebtoken',       version: '9.0.2' },
  { name: 'bcryptjs',           version: '2.4.3' },
  { name: 'multer',             version: '2.1.1' },
  { name: 'sharp',              version: '0.34.5' },
  { name: 'express-rate-limit', version: '8.3.1' },
];

function Section({ title, children }) {
  return (
    <div className="mb-8">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-discord-muted mb-3">{title}</h2>
      {children}
    </div>
  );
}

function VersionTable({ rows }) {
  return (
    <div className="bg-discord-darker rounded-lg overflow-hidden">
      {rows.map(({ name, version }, i) => (
        <div key={name} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i !== rows.length - 1 ? 'border-b border-discord-bg/50' : ''}`}>
          <span className="text-discord-text">{name}</span>
          <span className="text-discord-muted font-mono">{version}</span>
        </div>
      ))}
    </div>
  );
}

export default function AboutPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-discord-bg flex flex-col">
      {/* Header */}
      <div className="h-14 bg-discord-sidebar border-b border-discord-darker/50 flex items-center px-6 gap-3 shrink-0">
        <button
          onClick={() => router.back()}
          className="text-discord-muted hover:text-white transition-colors"
          title="Go back"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z"/>
          </svg>
        </button>
        <h1 className="text-white font-semibold text-lg">About</h1>
      </div>

      <div className="flex-1 overflow-y-auto p-8">
        <div className="max-w-xl mx-auto">

          {/* App identity */}
          <div className="flex items-center gap-4 mb-10">
            <img src="/favicon.svg" alt="logo" className="w-14 h-14 rounded-xl" />
            <div>
              <h1 className="text-white text-2xl font-bold">CompuGlobalHyperMegaNet</h1>
              <p className="text-discord-muted text-sm mt-0.5">Version {APP_VERSION}</p>
            </div>
          </div>

          <Section title="Frontend">
            <VersionTable rows={CLIENT_DEPS} />
          </Section>

          <Section title="Backend">
            <VersionTable rows={SERVER_DEPS} />
          </Section>

          <Section title="Legal">
            <div className="bg-discord-darker rounded-lg px-4 py-4 text-sm text-discord-muted space-y-3 leading-relaxed">
              <p>
                Copyright &copy; {new Date().getFullYear()} Flancrest Enterprises. All rights reserved.
              </p>
              <p>
                This software is provided for personal use only. Redistribution or commercial use
                without explicit written permission is prohibited.
              </p>
              <p>
                This project is an independent creation and is not affiliated with, endorsed by,
                or associated with Discord Inc. or any of its subsidiaries.
              </p>
              <p>
                Third-party libraries used in this project are subject to their respective licenses.
                WebRTC functionality is provided by{' '}
                <span className="text-discord-text">simple-peer</span> (MIT License).
                Emoji data is provided by{' '}
                <span className="text-discord-text">emoji-mart</span> (MIT License).
              </p>
            </div>
          </Section>

        </div>
      </div>
    </div>
  );
}
