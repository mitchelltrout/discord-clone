'use client';
import DMList from '../../../components/dm/DMList';
import { useAuthStore } from '../../../lib/stores/authStore';

export default function DMHomePage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="flex h-full">
      <DMList />
      <div className="flex-1 flex items-center justify-center bg-discord-bg">
        <div className="text-center">
          <p className="text-white text-xl font-semibold mb-2">Welcome back, {user?.username}!</p>
          <p className="text-discord-muted">Select a conversation or open a new DM to get started.</p>
        </div>
      </div>
    </div>
  );
}
