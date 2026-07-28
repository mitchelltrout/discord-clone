import { getMediaUrl } from '../../lib/api';

const COLORS = ['#5865f2', '#3ba55d', '#faa81a', '#ed4245', '#eb459e', '#00aeef'];

function colorFromUsername(username) {
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

export default function Avatar({ username = '?', avatarUrl, size = 40 }) {
  const src = getMediaUrl(avatarUrl);
  if (src) {
    return (
      <img
        src={src}
        alt={username}
        style={{ width: size, height: size }}
        className="rounded-full object-cover shrink-0"
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        background: colorFromUsername(username),
        fontSize: size * 0.4,
      }}
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0 select-none"
    >
      {username.charAt(0).toUpperCase()}
    </div>
  );
}
