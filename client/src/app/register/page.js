'use client';
import { useState, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '../../lib/api';
import { useAuthStore } from '../../lib/stores/authStore';

function AppLogo({ size = 48 }) {
  return (
    <div style={{ width: size, height: size }}>
      <svg viewBox="0 0 64 64" xmlns="http://www.w3.org/2000/svg" width={size} height={size}>
        <defs>
          <linearGradient id="lg2" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#00c6ff"/>
            <stop offset="100%" stopColor="#7c3aed"/>
          </linearGradient>
        </defs>
        <rect width="64" height="64" rx="14" fill="url(#lg2)"/>
        <circle cx="32" cy="32" r="18" fill="none" stroke="white" strokeWidth="2.5"/>
        <ellipse cx="32" cy="32" rx="10" ry="18" fill="none" stroke="white" strokeWidth="1.5"/>
        <line x1="14" y1="32" x2="50" y2="32" stroke="white" strokeWidth="1.5"/>
        <line x1="16" y1="24" x2="48" y2="24" stroke="white" strokeWidth="1.2"/>
        <line x1="16" y1="40" x2="48" y2="40" stroke="white" strokeWidth="1.2"/>
        <path d="M 44 18 Q 52 26 52 32" fill="none" stroke="#00ffcc" strokeWidth="2.5" strokeLinecap="round"/>
        <path d="M 47 14 Q 58 24 58 32" fill="none" stroke="#00ffcc" strokeWidth="2" strokeLinecap="round" opacity="0.6"/>
      </svg>
    </div>
  );
}

export default function RegisterPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteCode = searchParams.get('invite');
  const login = useAuthStore((s) => s.login);
  const [form, setForm] = useState({ username: '', email: '', password: '', invite_code: inviteCode || '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [systemMessage, setSystemMessage] = useState('');
  const [registrationMode, setRegistrationMode] = useState('1');

  useEffect(() => {
    api.get('/config').then(({ data }) => {
      setSystemMessage(data.system_message || '');
      setRegistrationMode(data.registration_mode ?? '1');
    }).catch(() => {});
  }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    if (form.password.length < 6) return setError('Password must be at least 6 characters');
    setLoading(true);
    try {
      const payload = { username: form.username, email: form.email, password: form.password };
      if (registrationMode === 'invite') payload.invite_code = form.invite_code;
      const { data } = await api.post('/auth/register', payload);
      login(data.user, data.accessToken, data.refreshToken);
      if (inviteCode) {
        router.push(`/invite/${inviteCode}`);
      } else {
        router.push('/channels/me');
      }
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-discord-darker">
      <div className="bg-discord-sidebar rounded-lg p-8 w-full max-w-md shadow-xl">
        <div className="flex flex-col items-center mb-6">
          <AppLogo size={56} />
          <p className="mt-2 text-xs font-bold tracking-widest uppercase" style={{background:'linear-gradient(90deg,#00c6ff,#7c3aed)', WebkitBackgroundClip:'text', WebkitTextFillColor:'transparent'}}>CompuGlobalHyperMegaNet</p>
          <h1 className="text-2xl font-bold text-white text-center mt-3 mb-0.5">Create an account</h1>
          <p className="text-discord-muted text-center text-sm">Join your friends today!</p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {error && (
            <div className="bg-discord-red/20 border border-discord-red text-discord-red rounded p-3 text-sm">
              {error}
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Username</label>
            <input
              type="text"
              required
              value={form.username}
              onChange={(e) => setForm({ ...form, username: e.target.value })}
              className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Email</label>
            <input
              type="email"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Password</label>
            <input
              type="password"
              required
              value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })}
              className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none"
            />
          </div>
          {registrationMode === 'invite' && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Invite Code</label>
              <input
                type="text"
                required
                value={form.invite_code}
                onChange={(e) => setForm({ ...form, invite_code: e.target.value })}
                placeholder="Enter your invite code"
                className="bg-discord-darker rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none font-mono tracking-widest uppercase"
              />
            </div>
          )}
          <button
            type="submit"
            disabled={loading}
            className="bg-discord-blurple hover:bg-blue-500 text-white font-semibold rounded py-2.5 mt-2 transition-colors disabled:opacity-60"
          >
            {loading ? 'Creating account...' : 'Continue'}
          </button>
        </form>

        <p className="text-discord-muted text-sm mt-4 text-center">
          Already have an account?{' '}
          <Link href={inviteCode ? `/login?invite=${inviteCode}` : '/login'} className="text-discord-blurple hover:underline">Log in</Link>
        </p>
        {systemMessage && (
          <p className="text-discord-muted text-xs text-center mt-4 border-t border-discord-darker/60 pt-4 italic">
            {systemMessage}
          </p>
        )}
      </div>
    </div>
  );
}
