'use client';
import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useServerStore } from '../../../lib/stores/serverStore';
import api from '../../../lib/api';

export default function ServerHomePage() {
  const { serverId } = useParams();
  const router = useRouter();
  const channels = useServerStore((s) => s.channels[serverId]);

  useEffect(() => {
    async function redirect() {
      let chs = channels;
      if (!chs) {
        try {
          const { data } = await api.get(`/servers/${serverId}`);
          const { setServerData } = useServerStore.getState();
          setServerData(serverId, data.channels, data.members);
          chs = data.channels;
        } catch { return; }
      }
      const first = chs?.find((c) => c.type === 'text');
      if (first) router.replace(`/channels/${serverId}/${first.id}`);
    }
    redirect();
  }, [serverId, channels]);

  return (
    <div className="flex-1 flex items-center justify-center bg-discord-bg">
      <p className="text-discord-muted">Loading server...</p>
    </div>
  );
}
