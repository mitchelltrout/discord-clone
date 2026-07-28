'use client';
import { usePathname } from 'next/navigation';
import { useServerStore } from '../../lib/stores/serverStore';
import { useAuthStore } from '../../lib/stores/authStore';
import api from '../../lib/api';
import Avatar from '../ui/Avatar';
import { ProfileHover } from '../ui/ProfileCard';

const STATUS_COLOR = {
  online: 'bg-discord-green',
  idle:   'bg-yellow-400',
  dnd:    'bg-discord-red',
  offline: 'bg-gray-500',
};

const STATUS_LABEL = {
  online: 'Online',
  idle:   'Idle',
  dnd:    'Do Not Disturb',
  offline: 'Offline',
};

const ROLE_ORDER = { owner: 0, admin: 1, member: 2 };

export default function MemberList() {
  const pathname = usePathname();
  const { members, removeMember } = useServerStore();
  const currentUser = useAuthStore((s) => s.user);

  const urlMatch = pathname.match(/^\/channels\/(\d+)/);
  const serverId = urlMatch ? parseInt(urlMatch[1]) : null;

  if (!serverId) return null;

  const serverMembers = members[serverId] || [];
  const myRole = serverMembers.find((m) => m.id === currentUser?.id)?.role;
  const canManage = myRole === 'owner' || myRole === 'admin';

  async function handleKick(member) {
    if (!confirm(`Kick ${member.username} from the server?`)) return;
    try {
      await api.delete(`/servers/${serverId}/members/${member.id}`);
      removeMember(serverId, member.id);
    } catch (e) {
      alert(e.response?.data?.error || 'Failed to kick member');
    }
  }

  // Group by online/offline
  const online = serverMembers.filter((m) => m.status !== 'offline').sort((a, b) => ROLE_ORDER[a.role] - ROLE_ORDER[b.role]);
  const offline = serverMembers.filter((m) => m.status === 'offline').sort((a, b) => a.username.localeCompare(b.username));

  return (
    <div className="w-60 bg-discord-sidebar flex flex-col shrink-0 overflow-y-auto">
      <div className="p-3">
        {online.length > 0 && (
          <div className="mb-4">
            <p className="text-xs font-semibold text-discord-muted uppercase tracking-wide px-2 mb-1">
              Online — {online.length}
            </p>
            {online.map((m) => (
              <MemberRow key={m.id} member={m} isYou={m.id === currentUser?.id} canManage={canManage} onKick={handleKick} />
            ))}
          </div>
        )}
        {offline.length > 0 && (
          <div>
            <p className="text-xs font-semibold text-discord-muted uppercase tracking-wide px-2 mb-1">
              Offline — {offline.length}
            </p>
            {offline.map((m) => (
              <MemberRow key={m.id} member={m} isYou={m.id === currentUser?.id} canManage={canManage} onKick={handleKick} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function MemberRow({ member, isYou, canManage, onKick }) {
  const canKick = canManage && !isYou && member.role !== 'owner' && !member.is_bot;
  return (
    <ProfileHover userId={member.id}>
    <div className="flex items-center gap-2 px-2 py-1 rounded hover:bg-discord-input/50 group cursor-default">
      <div className="relative shrink-0">
        <Avatar username={member.username} avatarUrl={member.avatar_url} size={32} />
        <span
          className={`absolute bottom-0 right-0 w-3 h-3 rounded-full border-2 border-discord-sidebar ${STATUS_COLOR[member.status] || STATUS_COLOR.offline}`}
          title={STATUS_LABEL[member.status] || 'Offline'}
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 min-w-0">
          <p className={`text-sm font-medium truncate ${member.status === 'offline' ? 'text-discord-muted' : 'text-discord-text'}`}>
            {member.username}{isYou ? ' (you)' : ''}
          </p>
        </div>
        {member.status_message ? (
          <p className="text-xs text-discord-muted truncate italic">{member.status_message}</p>
        ) : member.role !== 'member' ? (
          <p className="text-xs text-discord-muted capitalize">{member.role}</p>
        ) : null}
      </div>
      {canKick && (
        <button
          onClick={() => onKick(member)}
          className="hidden group-hover:flex shrink-0 text-discord-muted hover:text-discord-red transition-colors"
          title={`Kick ${member.username}`}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
            <path d="M10.09 15.59L11.5 17l5-5-5-5-1.41 1.41L12.67 11H3v2h9.67l-2.58 2.59zM19 3H5c-1.11 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z"/>
          </svg>
        </button>
      )}
    </div>
    </ProfileHover>
  );
}
