'use client';
import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../lib/stores/authStore';
import api, { getMediaUrl } from '../../lib/api';

const AUDIT_EVENT_TYPES = ['', 'login', 'logout', 'register'];
const MSG_LIMIT = 50;

export default function AdminPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [tab, setTab] = useState('users');
  const [stats, setStats] = useState(null);

  // Site settings
  const [settings, setSettings] = useState(null);
  const [systemMessageDraft, setSystemMessageDraft] = useState('');

  // Steve 2.0
  const [steve, setSteve] = useState(null);
  const [steveName, setSteveName] = useState('');
  const [steveAvatarPreview, setSteveAvatarPreview] = useState(null);
  const [steveAvatarFile, setSteveAvatarFile] = useState(null);
  const [steveSaving, setSteveSaving] = useState(false);
  const [steveSuccess, setSteveSuccess] = useState('');
  const [steveError, setSteveError] = useState('');
  const steveFileRef = useRef(null);

  // Users
  const [users, setUsers] = useState([]);

  // Servers
  const [servers, setServers] = useState([]);

  // Messages
  const [messages, setMessages] = useState([]);
  const [msgTotal, setMsgTotal] = useState(0);
  const [msgSearch, setMsgSearch] = useState('');
  const [msgOffset, setMsgOffset] = useState(0);

  // DMs
  const [dms, setDms] = useState([]);
  const [dmTotal, setDmTotal] = useState(0);
  const [dmSearch, setDmSearch] = useState('');
  const [dmOffset, setDmOffset] = useState(0);

  // Audit log
  const [auditEvents, setAuditEvents] = useState([]);
  const [auditTotal, setAuditTotal] = useState(0);
  const [auditOffset, setAuditOffset] = useState(0);
  const [auditType, setAuditType] = useState('');

  // Analytics
  const [analytics, setAnalytics] = useState(null);

  useEffect(() => {
    if (!user) { router.replace('/login'); return; }
    if (!user.is_admin) { router.replace('/channels/me'); return; }
    api.get('/admin/stats').then(({ data }) => setStats(data)).catch(console.error);
  }, [user]);

  useEffect(() => {
    if (!user?.is_admin) return;
    if (tab === 'users') api.get('/admin/users').then(({ data }) => setUsers(data));
    if (tab === 'servers') api.get('/admin/servers').then(({ data }) => setServers(data));
    if (tab === 'messages') fetchMessages(0, msgSearch);
    if (tab === 'dms') fetchDms(0, dmSearch);
    if (tab === 'audit') fetchAudit(0, auditType);
    if (tab === 'analytics') api.get('/admin/analytics').then(({ data }) => setAnalytics(data));
    if (tab === 'settings') {
      api.get('/admin/settings').then(({ data }) => {
        setSettings(data);
        setSystemMessageDraft(data.system_message || '');
      });
      api.get('/admin/steve').then(({ data }) => {
        setSteve(data);
        setSteveName(data?.username || '');
        setSteveAvatarPreview(getMediaUrl(data?.avatar_url));
        setSteveAvatarFile(null);
        setSteveSuccess('');
        setSteveError('');
      });
    }
  }, [tab]);

  const fetchMessages = useCallback((offset, search) => {
    const params = new URLSearchParams({ limit: MSG_LIMIT, offset });
    if (search) params.set('search', search);
    api.get(`/admin/messages?${params}`).then(({ data }) => {
      setMessages(data.messages); setMsgTotal(data.total); setMsgOffset(offset);
    });
  }, []);

  const fetchDms = useCallback((offset, search) => {
    const params = new URLSearchParams({ limit: MSG_LIMIT, offset });
    if (search) params.set('search', search);
    api.get(`/admin/dms?${params}`).then(({ data }) => {
      setDms(data.messages); setDmTotal(data.total); setDmOffset(offset);
    });
  }, []);

  const fetchAudit = useCallback((offset, type) => {
    const params = new URLSearchParams({ limit: MSG_LIMIT, offset });
    if (type) params.set('type', type);
    api.get(`/admin/audit?${params}`).then(({ data }) => {
      setAuditEvents(data.events); setAuditTotal(data.total); setAuditOffset(offset);
    });
  }, []);

  async function deleteUser(id) {
    if (!confirm('Delete this user? This cannot be undone.')) return;
    await api.delete(`/admin/users/${id}`);
    setUsers((u) => u.filter((x) => x.id !== id));
  }

  async function toggleAdmin(id, current) {
    await api.patch(`/admin/users/${id}/admin`, { is_admin: !current });
    setUsers((u) => u.map((x) => x.id === id ? { ...x, is_admin: current ? 0 : 1 } : x));
  }

  async function deleteServer(id) {
    if (!confirm('Delete this server and all its data? This cannot be undone.')) return;
    await api.delete(`/admin/servers/${id}`);
    setServers((s) => s.filter((x) => x.id !== id));
  }

  async function deleteMessage(id) {
    await api.delete(`/admin/messages/${id}`);
    setMessages((m) => m.filter((x) => x.id !== id));
  }

  async function deleteDm(id) {
    await api.delete(`/admin/dms/${id}`);
    setDms((m) => m.filter((x) => x.id !== id));
  }

  async function setRegistrationMode(mode) {
    const { data } = await api.patch('/admin/settings', { registration_open: mode });
    setSettings(data);
    if (mode === 'invite') fetchInviteCodes();
  }

  async function saveSystemMessage(e) {
    e.preventDefault();
    const { data } = await api.patch('/admin/settings', { system_message: systemMessageDraft });
    setSettings(data);
  }

  async function saveSteve(e) {
    e.preventDefault();
    setSteveError('');
    setSteveSuccess('');
    setSteveSaving(true);
    try {
      let updated = steve;
      if (steveAvatarFile) {
        const fd = new FormData();
        fd.append('avatar', steveAvatarFile);
        const { data } = await api.post('/admin/steve/avatar', fd);
        updated = data;
        setSteveAvatarFile(null);
      }
      if (steveName.trim() && steveName.trim() !== updated?.username) {
        const { data } = await api.patch('/admin/steve', { username: steveName.trim() });
        updated = data;
      }
      setSteve(updated);
      setSteveName(updated?.username || '');
      setSteveAvatarPreview(getMediaUrl(updated?.avatar_url));
      setSteveSuccess('Saved!');
    } catch (err) {
      setSteveError(err.response?.data?.error || 'Failed to save');
    } finally {
      setSteveSaving(false);
    }
  }

  if (!user?.is_admin) return null;

  const TABS = ['users', 'servers', 'messages', 'dms', 'audit', 'analytics', 'settings'];

  return (
    <div className="min-h-screen bg-discord-bg text-discord-text">
      {/* Header */}
      <div className="bg-discord-darker border-b border-black/20 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-white font-bold text-xl">Admin Panel</h1>
          {stats && (
            <p className="text-discord-muted text-sm mt-0.5">
              {stats.users} users · {stats.servers} servers · {stats.messages} messages
            </p>
          )}
        </div>
        <button
          onClick={() => router.push('/channels/me')}
          className="text-discord-muted hover:text-white text-sm transition-colors"
        >
          ← Back to app
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-black/20 px-6">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-3 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-discord-blurple text-white'
                : 'border-transparent text-discord-muted hover:text-discord-text'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      <div className="p-6">

        {/* ── Users ── */}
        {tab === 'users' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-discord-muted text-left border-b border-discord-darker">
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">Username</th>
                  <th className="pb-2 pr-4">Email</th>
                  <th className="pb-2 pr-4">Status</th>
                  <th className="pb-2 pr-4">Servers</th>
                  <th className="pb-2 pr-4">Messages</th>
                  <th className="pb-2 pr-4">Logins</th>
                  <th className="pb-2 pr-4">Last Login</th>
                  <th className="pb-2 pr-4">Joined</th>
                  <th className="pb-2 pr-4">Admin</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-discord-darker/40 hover:bg-discord-darker/30">
                    <td className="py-2 pr-4 text-discord-muted">{u.id}</td>
                    <td className="py-2 pr-4 text-white font-medium">{u.username}</td>
                    <td className="py-2 pr-4 text-discord-muted">{u.email}</td>
                    <td className="py-2 pr-4"><StatusBadge status={u.status} /></td>
                    <td className="py-2 pr-4 text-discord-muted">{u.server_count}</td>
                    <td className="py-2 pr-4 text-discord-muted">{u.message_count}</td>
                    <td className="py-2 pr-4 text-discord-muted">{u.login_count}</td>
                    <td className="py-2 pr-4 text-discord-muted text-xs whitespace-nowrap">
                      {u.last_login_at ? new Date(u.last_login_at * 1000).toLocaleString() : '—'}
                    </td>
                    <td className="py-2 pr-4 text-discord-muted text-xs whitespace-nowrap">
                      {new Date(u.created_at * 1000).toLocaleDateString()}
                    </td>
                    <td className="py-2 pr-4">
                      <button
                        onClick={() => toggleAdmin(u.id, u.is_admin)}
                        className={`text-xs px-2 py-0.5 rounded font-medium transition-colors ${
                          u.is_admin
                            ? 'bg-discord-blurple text-white hover:bg-red-500'
                            : 'bg-discord-darker text-discord-muted hover:bg-discord-blurple hover:text-white'
                        }`}
                        title={u.is_admin ? 'Revoke admin' : 'Grant admin'}
                      >
                        {u.is_admin ? 'Admin' : 'User'}
                      </button>
                    </td>
                    <td className="py-2">
                      {u.id !== user.id && (
                        <button onClick={() => deleteUser(u.id)} className="text-xs text-discord-muted hover:text-discord-red transition-colors">
                          Delete
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Servers ── */}
        {tab === 'servers' && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-discord-muted text-left border-b border-discord-darker">
                  <th className="pb-2 pr-4">ID</th>
                  <th className="pb-2 pr-4">Name</th>
                  <th className="pb-2 pr-4">Owner</th>
                  <th className="pb-2 pr-4">Members</th>
                  <th className="pb-2 pr-4">Channels</th>
                  <th className="pb-2 pr-4">Invite Code</th>
                  <th className="pb-2">Actions</th>
                </tr>
              </thead>
              <tbody>
                {servers.map((s) => (
                  <tr key={s.id} className="border-b border-discord-darker/40 hover:bg-discord-darker/30">
                    <td className="py-2 pr-4 text-discord-muted">{s.id}</td>
                    <td className="py-2 pr-4 text-white font-medium">{s.name}</td>
                    <td className="py-2 pr-4 text-discord-muted">{s.owner_username}</td>
                    <td className="py-2 pr-4 text-discord-muted">{s.member_count}</td>
                    <td className="py-2 pr-4 text-discord-muted">{s.channel_count}</td>
                    <td className="py-2 pr-4 font-mono text-xs text-discord-muted">{s.invite_code}</td>
                    <td className="py-2">
                      <button onClick={() => deleteServer(s.id)} className="text-xs text-discord-muted hover:text-discord-red transition-colors">
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ── Messages ── */}
        {tab === 'messages' && (
          <div>
            <form onSubmit={(e) => { e.preventDefault(); fetchMessages(0, msgSearch); }} className="flex gap-2 mb-4">
              <input value={msgSearch} onChange={(e) => setMsgSearch(e.target.value)} placeholder="Search message content..."
                className="bg-discord-darker rounded px-3 py-2 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none text-sm w-72" />
              <button type="submit" className="px-4 py-2 bg-discord-blurple hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors">Search</button>
              {msgSearch && <button type="button" onClick={() => { setMsgSearch(''); fetchMessages(0, ''); }} className="px-3 py-2 text-discord-muted hover:text-white text-sm transition-colors">Clear</button>}
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-discord-muted text-left border-b border-discord-darker">
                    <th className="pb-2 pr-4">User</th>
                    <th className="pb-2 pr-4">Server / Channel</th>
                    <th className="pb-2 pr-4">Content</th>
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {messages.map((m) => (
                    <tr key={m.id} className="border-b border-discord-darker/40 hover:bg-discord-darker/30">
                      <td className="py-2 pr-4 text-white font-medium whitespace-nowrap">{m.username}</td>
                      <td className="py-2 pr-4 text-discord-muted whitespace-nowrap">{m.server_name} / #{m.channel_name}</td>
                      <td className="py-2 pr-4 text-discord-text max-w-xs truncate">{m.content}</td>
                      <td className="py-2 pr-4 text-discord-muted whitespace-nowrap text-xs">{new Date(m.created_at * 1000).toLocaleString()}</td>
                      <td className="py-2"><button onClick={() => deleteMessage(m.id)} className="text-xs text-discord-muted hover:text-discord-red transition-colors">Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={msgTotal} offset={msgOffset} limit={MSG_LIMIT} onPage={(o) => fetchMessages(o, msgSearch)} />
          </div>
        )}

        {/* ── DMs ── */}
        {tab === 'dms' && (
          <div>
            <form onSubmit={(e) => { e.preventDefault(); fetchDms(0, dmSearch); }} className="flex gap-2 mb-4">
              <input value={dmSearch} onChange={(e) => setDmSearch(e.target.value)} placeholder="Search DM content..."
                className="bg-discord-darker rounded px-3 py-2 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none text-sm w-72" />
              <button type="submit" className="px-4 py-2 bg-discord-blurple hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors">Search</button>
              {dmSearch && <button type="button" onClick={() => { setDmSearch(''); fetchDms(0, ''); }} className="px-3 py-2 text-discord-muted hover:text-white text-sm transition-colors">Clear</button>}
            </form>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-discord-muted text-left border-b border-discord-darker">
                    <th className="pb-2 pr-4">From</th>
                    <th className="pb-2 pr-4">To</th>
                    <th className="pb-2 pr-4">Content</th>
                    <th className="pb-2 pr-4">Date</th>
                    <th className="pb-2">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {dms.map((m) => (
                    <tr key={m.id} className="border-b border-discord-darker/40 hover:bg-discord-darker/30">
                      <td className="py-2 pr-4 text-white font-medium whitespace-nowrap">{m.username}</td>
                      <td className="py-2 pr-4 text-discord-muted whitespace-nowrap">{m.to_username}</td>
                      <td className="py-2 pr-4 text-discord-text max-w-xs truncate">{m.content}</td>
                      <td className="py-2 pr-4 text-discord-muted whitespace-nowrap text-xs">{new Date(m.created_at * 1000).toLocaleString()}</td>
                      <td className="py-2"><button onClick={() => deleteDm(m.id)} className="text-xs text-discord-muted hover:text-discord-red transition-colors">Delete</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={dmTotal} offset={dmOffset} limit={MSG_LIMIT} onPage={(o) => fetchDms(o, dmSearch)} />
          </div>
        )}

        {/* ── Audit Log ── */}
        {tab === 'audit' && (
          <div>
            <div className="flex gap-2 mb-4 items-center">
              <span className="text-discord-muted text-sm">Filter:</span>
              {AUDIT_EVENT_TYPES.map((t) => (
                <button
                  key={t || 'all'}
                  onClick={() => { setAuditType(t); fetchAudit(0, t); }}
                  className={`px-3 py-1 rounded text-sm font-medium transition-colors ${
                    auditType === t
                      ? 'bg-discord-blurple text-white'
                      : 'bg-discord-darker text-discord-muted hover:text-white'
                  }`}
                >
                  {t || 'All'}
                </button>
              ))}
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-discord-muted text-left border-b border-discord-darker">
                    <th className="pb-2 pr-4">Time</th>
                    <th className="pb-2 pr-4">Event</th>
                    <th className="pb-2 pr-4">User</th>
                    <th className="pb-2 pr-4">IP Address</th>
                    <th className="pb-2">Browser</th>
                  </tr>
                </thead>
                <tbody>
                  {auditEvents.map((e) => (
                    <tr key={e.id} className="border-b border-discord-darker/40 hover:bg-discord-darker/30">
                      <td className="py-2 pr-4 text-discord-muted text-xs whitespace-nowrap">
                        {new Date(e.created_at * 1000).toLocaleString()}
                      </td>
                      <td className="py-2 pr-4"><EventBadge type={e.event_type} /></td>
                      <td className="py-2 pr-4 text-white font-medium">
                        {e.username || <span className="text-discord-muted italic">deleted</span>}
                      </td>
                      <td className="py-2 pr-4 font-mono text-xs text-discord-muted">{e.ip || '—'}</td>
                      <td className="py-2 text-discord-muted text-xs max-w-xs truncate" title={e.user_agent}>
                        {e.user_agent ? shortenUA(e.user_agent) : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Pagination total={auditTotal} offset={auditOffset} limit={MSG_LIMIT} onPage={(o) => fetchAudit(o, auditType)} />
          </div>
        )}

        {/* ── Settings ── */}
        {tab === 'settings' && (
          <div className="max-w-lg space-y-8">
            {/* Registration mode */}
            <div className="bg-discord-darker rounded-lg p-5 space-y-4">
              <div>
                <p className="text-white font-semibold">New Member Registration</p>
                <p className="text-discord-muted text-sm mt-0.5">
                  {settings?.registration_open === '1' && 'Open — anyone can create an account.'}
                  {settings?.registration_open === 'invite' && 'Invite only — users must have a valid server invite link to register.'}
                  {settings?.registration_open === '0' && 'Closed — new registrations are blocked.'}
                </p>
              </div>
              <div className="flex gap-2">
                {[
                  { value: '1', label: 'Open' },
                  { value: 'invite', label: 'Invite Only' },
                  { value: '0', label: 'Closed' },
                ].map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setRegistrationMode(value)}
                    className={`flex-1 py-2 rounded text-sm font-semibold transition-colors ${
                      settings?.registration_open === value
                        ? 'bg-discord-blurple text-white'
                        : 'bg-discord-input text-discord-muted hover:text-white'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {settings?.registration_open === 'invite' && (
                <p className="text-discord-muted text-xs pt-1">
                  Any valid server invite link code will work. Share your server invite links with people you want to allow in.
                </p>
              )}
            </div>

            {/* Steve 2.0 */}
            <div className="bg-discord-darker rounded-lg p-5">
              <p className="text-white font-semibold mb-1">Steve 2.0</p>
              <p className="text-discord-muted text-sm mb-4">Update the bot's display name and avatar.</p>
              <form onSubmit={saveSteve} className="flex flex-col gap-4">
                {/* Avatar */}
                <div className="flex items-center gap-4">
                  <div
                    className="relative cursor-pointer group shrink-0"
                    onClick={() => steveFileRef.current?.click()}
                  >
                    {steveAvatarPreview ? (
                      <img src={steveAvatarPreview} alt="Steve avatar" className="w-16 h-16 rounded-full object-cover" />
                    ) : (
                      <div className="w-16 h-16 rounded-full bg-discord-blurple flex items-center justify-center text-white text-xl font-bold">S</div>
                    )}
                    <div className="absolute inset-0 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                      </svg>
                    </div>
                  </div>
                  <div className="flex flex-col gap-0.5">
                    <p className="text-discord-text text-sm">Click avatar to change</p>
                    <p className="text-discord-muted text-xs">Resized to 128×128 webp</p>
                  </div>
                  <input
                    ref={steveFileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const f = e.target.files[0];
                      if (!f) return;
                      setSteveAvatarFile(f);
                      setSteveAvatarPreview(URL.createObjectURL(f));
                    }}
                  />
                </div>
                {/* Name */}
                <div className="flex flex-col gap-1">
                  <label className="text-xs font-semibold text-discord-muted uppercase tracking-wide">Display Name</label>
                  <input
                    value={steveName}
                    onChange={(e) => setSteveName(e.target.value)}
                    className="bg-discord-bg rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none text-sm"
                  />
                </div>
                {steveError && <p className="text-discord-red text-sm">{steveError}</p>}
                {steveSuccess && <p className="text-discord-green text-sm">{steveSuccess}</p>}
                <button
                  type="submit"
                  disabled={steveSaving}
                  className="self-start px-4 py-1.5 bg-discord-blurple hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors disabled:opacity-60"
                >
                  {steveSaving ? 'Saving...' : 'Save'}
                </button>
              </form>
            </div>

            {/* System message */}
            <div className="bg-discord-darker rounded-lg p-5">
              <p className="text-white font-semibold mb-1">System Message</p>
              <p className="text-discord-muted text-sm mb-3">Displayed on the login and registration screens.</p>
              <form onSubmit={saveSystemMessage} className="flex flex-col gap-3">
                <textarea
                  value={systemMessageDraft}
                  onChange={(e) => setSystemMessageDraft(e.target.value)}
                  rows={3}
                  maxLength={280}
                  placeholder="Leave blank to hide the message."
                  className="bg-discord-bg rounded p-2.5 text-discord-text border border-transparent focus:border-discord-blurple focus:outline-none resize-none text-sm"
                />
                <div className="flex items-center justify-between">
                  <span className="text-discord-muted text-xs">{systemMessageDraft.length}/280</span>
                  <button type="submit" className="px-4 py-1.5 bg-discord-blurple hover:bg-blue-500 text-white rounded text-sm font-medium transition-colors">
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* ── Analytics ── */}
        {tab === 'analytics' && !analytics && (
          <p className="text-discord-muted text-sm">Loading analytics...</p>
        )}
        {tab === 'analytics' && analytics && (
          <div className="space-y-8">
            {/* Stat cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <StatCard label="Page Views (30d)" value={analytics.pageViews.reduce((s, d) => s + d.count, 0)} />
              <StatCard label="Logins (30d)" value={analytics.logins.reduce((s, d) => s + d.count, 0)} />
              <StatCard label="Signups (30d)" value={analytics.signups.reduce((s, d) => s + d.count, 0)} />
              <StatCard label="Unique IPs Today" value={analytics.uniqueVisitorsToday} />
            </div>

            {/* Charts */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <ChartCard title="Page Views (30d)" data={analytics.pageViews} color="#5865f2" />
              <ChartCard title="Logins (30d)" data={analytics.logins} color="#3ba55d" />
              <ChartCard title="Signups (30d)" data={analytics.signups} color="#faa81a" />
            </div>

            {/* Top pages */}
            <div>
              <h3 className="text-white font-semibold mb-3">Top Pages</h3>
              <div className="bg-discord-darker rounded-lg overflow-hidden">
                {analytics.topPages.length === 0 && (
                  <p className="text-discord-muted text-sm px-4 py-4">No page visit data yet.</p>
                )}
                {analytics.topPages.map((p, i) => {
                  const maxCount = analytics.topPages[0]?.count || 1;
                  return (
                    <div key={i} className="flex items-center gap-3 px-4 py-2.5 border-b border-discord-bg/60 last:border-0">
                      <span className="text-discord-muted text-xs w-5 text-right">{i + 1}</span>
                      <span className="font-mono text-sm text-discord-text flex-1 truncate">{p.path}</span>
                      <div className="w-32 bg-discord-bg rounded-full h-1.5 overflow-hidden">
                        <div className="h-full bg-discord-blurple rounded-full" style={{ width: `${(p.count / maxCount) * 100}%` }} />
                      </div>
                      <span className="text-discord-muted text-xs w-10 text-right">{p.count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function StatusBadge({ status }) {
  const colors = { online: 'text-green-400', idle: 'text-yellow-400', dnd: 'text-red-400', offline: 'text-gray-500' };
  return <span className={`capitalize ${colors[status] || colors.offline}`}>{status}</span>;
}

function EventBadge({ type }) {
  const styles = {
    login:    'bg-green-500/20 text-green-400',
    logout:   'bg-gray-500/20 text-gray-400',
    register: 'bg-discord-blurple/20 text-discord-blurple',
  };
  return (
    <span className={`px-2 py-0.5 rounded text-xs font-medium ${styles[type] || 'bg-discord-darker text-discord-muted'}`}>
      {type}
    </span>
  );
}

function StatCard({ label, value }) {
  return (
    <div className="bg-discord-darker rounded-lg p-4">
      <p className="text-discord-muted text-xs uppercase tracking-wide mb-1">{label}</p>
      <p className="text-white text-2xl font-bold">{value.toLocaleString()}</p>
    </div>
  );
}

function ChartCard({ title, data, color }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const days = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const found = data.find((x) => x.day === key);
    days.push({ day: key, count: found?.count || 0 });
  }
  return (
    <div className="bg-discord-darker rounded-lg p-4">
      <p className="text-discord-muted text-xs uppercase tracking-wide mb-3">{title}</p>
      <div className="flex items-end gap-0.5 h-24">
        {days.map((d, i) => (
          <div
            key={i}
            className="flex-1 rounded-t min-w-0 cursor-default"
            style={{
              height: `${Math.max((d.count / max) * 100, d.count > 0 ? 4 : 0)}%`,
              background: color,
              minHeight: d.count > 0 ? '3px' : '0',
              opacity: 0.85,
            }}
            title={`${d.day}: ${d.count}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-discord-muted text-xs mt-1">
        <span>30d ago</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function Pagination({ total, offset, limit, onPage }) {
  const page = Math.floor(offset / limit) + 1;
  const totalPages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="flex items-center justify-between mt-4 text-sm text-discord-muted">
      <span>{total.toLocaleString()} total</span>
      <div className="flex gap-2">
        <button onClick={() => onPage(offset - limit)} disabled={offset === 0}
          className="px-3 py-1 bg-discord-darker rounded disabled:opacity-40 hover:bg-discord-input transition-colors">
          Previous
        </button>
        <span className="px-2 py-1">{page} / {totalPages}</span>
        <button onClick={() => onPage(offset + limit)} disabled={offset + limit >= total}
          className="px-3 py-1 bg-discord-darker rounded disabled:opacity-40 hover:bg-discord-input transition-colors">
          Next
        </button>
      </div>
    </div>
  );
}

function shortenUA(ua) {
  return ua.match(/(Chrome|Firefox|Safari|Edge|OPR)\/[\d.]+/)?.[0]
    || ua.match(/(MSIE|Trident)[\s/][\d.]+/)?.[0]
    || ua.slice(0, 40);
}
