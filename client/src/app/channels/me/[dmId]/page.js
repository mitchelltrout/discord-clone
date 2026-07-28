'use client';
import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import api from '../../../../lib/api';
import DMList from '../../../../components/dm/DMList';
import ChatView from '../../../../components/chat/ChatView';

export default function DMConversationPage() {
  const { dmId } = useParams();
  const [partner, setPartner] = useState(null);

  useEffect(() => {
    // Find partner info from conversations
    api.get('/dm').then(({ data }) => {
      const convo = data.find((c) => c.id == dmId);
      if (convo) setPartner({ username: convo.partner_username });
    }).catch(console.error);
  }, [dmId]);

  return (
    <div className="flex h-full">
      <DMList />
      <div className="flex-1 flex flex-col overflow-hidden">
        {dmId && (
          <ChatView
            channelId={dmId}
            isDM
            channelName={partner?.username || 'DM'}
          />
        )}
      </div>
    </div>
  );
}
