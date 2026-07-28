'use client';
import { useParams } from 'next/navigation';
import { useServerStore } from '../../../../lib/stores/serverStore';
import ChatView from '../../../../components/chat/ChatView';
import VoiceChannelView from '../../../../components/voice/VoiceChannelView';
import CanvasView from '../../../../components/canvas/CanvasView';

export default function ChannelPage() {
  const { serverId, channelId } = useParams();
  const serverChannels = useServerStore((s) => s.channels[serverId] || []);

  const channel = serverChannels.find((c) => c.id == channelId);

  if (!channel) {
    return (
      <div className="flex-1 flex items-center justify-center bg-discord-bg">
        <p className="text-discord-muted">Loading channel...</p>
      </div>
    );
  }

  if (channel.type === 'voice') {
    return (
      <VoiceChannelView
        channelId={channelId}
        channelName={channel.name}
        serverId={serverId}
      />
    );
  }

  if (channel.type === 'canvas') {
    return (
      <CanvasView
        channelId={channelId}
        channelName={channel.name}
        serverId={serverId}
      />
    );
  }

  return (
    <ChatView
      channelId={channelId}
      channelName={channel.name}
      serverId={serverId}
    />
  );
}
