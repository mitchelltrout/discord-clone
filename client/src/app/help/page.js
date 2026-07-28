'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '../../lib/stores/authStore';

const APP_VERSION = '1.0.0';

const CLIENT_DEPS = [
  { name: 'Next.js',          version: '14.2.3' },
  { name: 'React',            version: '18' },
  { name: 'Socket.io Client', version: '4.7.5' },
  { name: 'Zustand',          version: '4.5.2' },
  { name: 'simple-peer',      version: '9.11.1' },
  { name: 'Axios',            version: '1.6.8' },
  { name: 'date-fns',         version: '3.6.0' },
  { name: 'Tailwind CSS',     version: '3.4.3' },
  { name: 'emoji-mart',       version: '1.2.1' },
];

const SERVER_DEPS = [
  { name: 'Node.js',             version: 'v22+' },
  { name: 'Express',             version: '4.19.2' },
  { name: 'Socket.io',           version: '4.7.5' },
  { name: 'jsonwebtoken',        version: '9.0.2' },
  { name: 'bcryptjs',            version: '2.4.3' },
  { name: 'multer',              version: '2.1.1' },
  { name: 'sharp',               version: '0.34.5' },
  { name: 'express-rate-limit',  version: '8.3.1' },
];

const SECTIONS = [
  { id: 'getting-started',  label: 'Getting Started' },
  { id: 'servers',          label: 'Servers' },
  { id: 'channels',         label: 'Channels' },
  { id: 'messaging',        label: 'Messaging' },
  { id: 'mentions',         label: 'Mentions & Search' },
  { id: 'polls',            label: 'Polls' },
  { id: 'formatting',       label: 'Text Formatting' },
  { id: 'canvas',           label: 'Canvas Channels' },
  { id: 'voice-video',      label: 'Voice & Video' },
  { id: 'direct-messages',  label: 'Direct Messages' },
  { id: 'status',           label: 'Status' },
  { id: 'notifications',    label: 'Notifications' },
  { id: 'user-settings',    label: 'User Settings' },
  { id: 'steve',            label: 'Steve 2.0' },
  { id: 'about',            label: 'About' },
];

function SectionHeading({ id, children }) {
  return (
    <h2 id={id} className="text-white text-xl font-bold mb-4 pt-2 scroll-mt-6">{children}</h2>
  );
}

function SubHeading({ children }) {
  return <h3 className="text-white font-semibold mb-2 mt-5">{children}</h3>;
}

function P({ children }) {
  return <p className="text-discord-muted text-sm leading-relaxed mb-3">{children}</p>;
}

function Kbd({ children }) {
  return (
    <kbd className="bg-discord-darker border border-discord-input rounded px-1.5 py-0.5 text-xs font-mono text-discord-text">
      {children}
    </kbd>
  );
}

function TipBox({ children }) {
  return (
    <div className="bg-discord-blurple/10 border border-discord-blurple/30 rounded-lg px-4 py-3 text-sm text-discord-text mb-4">
      {children}
    </div>
  );
}

function NoteBox({ children }) {
  return (
    <div className="bg-discord-darker/60 border border-discord-darker rounded-lg px-4 py-3 text-sm text-discord-muted mb-4">
      {children}
    </div>
  );
}

function Table({ headers, rows }) {
  return (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="border-b border-discord-darker">
            {headers.map((h) => (
              <th key={h} className="text-left text-discord-muted font-semibold pb-2 pr-6 text-xs uppercase tracking-wide">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i} className="border-b border-discord-darker/40">
              {row.map((cell, j) => (
                <td key={j} className="py-2 pr-6 text-discord-text align-top">{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function VersionTable({ rows }) {
  return (
    <div className="bg-discord-darker rounded-lg overflow-hidden mb-4">
      {rows.map(({ name, version }, i) => (
        <div key={name} className={`flex items-center justify-between px-4 py-2.5 text-sm ${i !== rows.length - 1 ? 'border-b border-discord-bg/50' : ''}`}>
          <span className="text-discord-text">{name}</span>
          <span className="text-discord-muted font-mono">{version}</span>
        </div>
      ))}
    </div>
  );
}

export default function HelpPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const [activeSection, setActiveSection] = useState('getting-started');

  function scrollTo(id) {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  }

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
        <h1 className="text-white font-semibold text-lg">Help & Documentation</h1>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar nav */}
        <nav className="w-52 bg-discord-sidebar shrink-0 overflow-y-auto p-4 border-r border-discord-darker/50">
          <p className="text-discord-muted text-xs font-semibold uppercase tracking-widest mb-3 px-2">Contents</p>
          {SECTIONS.map((s) => (
            <button
              key={s.id}
              onClick={() => scrollTo(s.id)}
              className={`w-full text-left px-2 py-1.5 rounded text-sm transition-colors mb-0.5 ${
                activeSection === s.id
                  ? 'bg-discord-input text-white'
                  : 'text-discord-muted hover:text-discord-text hover:bg-discord-input/40'
              }`}
            >
              {s.label}
            </button>
          ))}
        </nav>

        {/* Content */}
        <main className="flex-1 overflow-y-auto px-10 py-8">
          <div className="max-w-2xl">

            {/* ── Getting Started ── */}
            <SectionHeading id="getting-started">Getting Started</SectionHeading>
            <P>
              CompuGlobalHyperMegaNet is a real-time chat and voice platform. You can create servers,
              invite friends, chat in text channels, hop into voice rooms, and message people directly —
              all in one place.
            </P>
            <SubHeading>Creating an Account</SubHeading>
            <P>
              Visit the <strong className="text-discord-text">Register</strong> page and enter a username,
              email, and password (minimum 6 characters). After registering you are logged in automatically.
            </P>
            <SubHeading>Joining a Server</SubHeading>
            <P>
              You can join an existing server two ways:
            </P>
            <ul className="list-disc list-inside text-discord-muted text-sm space-y-1.5 mb-4 ml-2">
              <li>Click the <strong className="text-discord-text">+</strong> button in the server sidebar and paste an invite link or code.</li>
              <li>Open an invite link directly — you will be taken to a confirmation page before joining.</li>
            </ul>
            <SubHeading>Creating a Server</SubHeading>
            <P>
              Click the <strong className="text-discord-text">+</strong> button in the server sidebar and choose
              "Create Server". Give it a name and it will be created with a default <strong className="text-discord-text">#general</strong> text
              channel and a <strong className="text-discord-text">General</strong> voice channel. You become the owner automatically.
            </P>

            <hr className="border-discord-darker my-8" />

            {/* ── Servers ── */}
            <SectionHeading id="servers">Servers</SectionHeading>
            <SubHeading>Roles</SubHeading>
            <Table
              headers={['Role', 'Permissions']}
              rows={[
                ['Owner',  'Full control — rename server, manage channels, kick members, reset invite, delete server, delete any message.'],
                ['Admin',  'Rename server and channels, create/delete channels, kick members, delete any message, pin messages.'],
                ['Member', 'Send messages, react, join voice channels.'],
              ]}
            />
            <SubHeading>Invite Links</SubHeading>
            <P>
              Click the person-with-plus icon in the server header to open the invite modal. Copy the link
              and share it. The link format is <code className="bg-discord-darker/70 px-1 rounded text-xs font-mono">/invite/[code]</code>.
            </P>
            <P>
              As server owner you can click <strong className="text-discord-text">Reset invite link</strong> at
              the bottom of the invite modal to invalidate the old code and generate a new one.
            </P>
            <SubHeading>Kicking Members</SubHeading>
            <P>
              Owners and admins can kick members from the member list on the right side of the screen.
              Hover a member's row to reveal the kick icon (door with arrow). The kicked user is immediately
              removed from the server and redirected if they are currently viewing it.
            </P>
            <SubHeading>Server Settings</SubHeading>
            <P>
              The gear icon in the server header (owners only) opens server settings where you can:
            </P>
            <ul className="list-disc list-inside text-discord-muted text-sm space-y-1.5 mb-4 ml-2">
              <li>Rename the server and upload a custom icon image.</li>
              <li>Toggle <strong className="text-discord-text">Steve 2.0</strong> on or off for the server.</li>
            </ul>
            <SubHeading>Leaving & Deleting</SubHeading>
            <ul className="list-disc list-inside text-discord-muted text-sm space-y-1.5 mb-4 ml-2">
              <li>Non-owners can leave a server via the door icon in the server header.</li>
              <li>The owner can delete the server from Server Settings — this permanently removes all channels, messages, and members.</li>
            </ul>

            <hr className="border-discord-darker my-8" />

            {/* ── Channels ── */}
            <SectionHeading id="channels">Channels</SectionHeading>
            <SubHeading>Text Channels</SubHeading>
            <P>
              Text channels appear under the <strong className="text-discord-text">Text Channels</strong> heading
              in the sidebar, prefixed with a <strong className="text-discord-text">#</strong>. Click one to
              open it. Unread channels appear bold with a white dot indicator.
            </P>
            <SubHeading>Voice Channels</SubHeading>
            <P>
              Voice channels appear under <strong className="text-discord-text">Voice Channels</strong>. Click
              one to join and open the voice view. The channel name turns green while you are connected. A
              persistent status bar at the bottom of the sidebar shows which channel you are in.
            </P>
            <P>
              The sidebar also shows who is currently in each voice channel. Icons next to a participant's
              name indicate their status: a crossed-out microphone means muted, a camera icon means their
              webcam is on, and a screen icon means they are sharing their screen.
            </P>
            <SubHeading>Creating Channels</SubHeading>
            <P>
              Owners and admins see a <strong className="text-discord-text">+</strong> button next to the
              Text Channels, Voice Channels, and Canvas Channels headers. Click it to open the create
              channel dialog and choose the channel type.
            </P>
            <SubHeading>Renaming & Deleting Channels</SubHeading>
            <P>
              Hover a channel row to reveal the pencil (rename) and trash (delete) icons. These are only
              visible to owners and admins.
            </P>
            <SubHeading>AFK Channel</SubHeading>
            <P>
              If you are idle in a server voice channel for 30 minutes with no mouse, keyboard, or click
              activity, the app automatically moves you to a temporary <strong className="text-discord-text">AFK</strong> channel.
              The AFK channel is created on demand and permanently deleted when the last person leaves it.
            </P>

            <hr className="border-discord-darker my-8" />

            {/* ── Messaging ── */}
            <SectionHeading id="messaging">Messaging</SectionHeading>
            <SubHeading>Sending Messages</SubHeading>
            <P>
              Type in the message box at the bottom of any text channel or DM conversation and press{' '}
              <Kbd>Enter</Kbd> to send. Use <Kbd>Shift</Kbd>+<Kbd>Enter</Kbd> for a new line without sending.
            </P>
            <SubHeading>Editing & Deleting</SubHeading>
            <P>
              Hover over a message to reveal action buttons in the top-right corner.
            </P>
            <ul className="list-disc list-inside text-discord-muted text-sm space-y-1.5 mb-4 ml-2">
              <li><strong className="text-discord-text">Edit</strong> — only available on your own messages. Click the pencil icon, make your changes, then press <Kbd>Enter</Kbd> to save or <Kbd>Esc</Kbd> to cancel. Edited messages show an <em>(edited)</em> label.</li>
              <li><strong className="text-discord-text">Delete</strong> — available on your own messages. Server owners and admins can delete any message in their server.</li>
            </ul>
            <SubHeading>Replying to Messages</SubHeading>
            <P>
              Hover a message and click the reply arrow icon to reply to it. The original message appears
              as a quote above your new message. Click the quoted preview in the reply composer to cancel.
              Clicking a quoted message in chat will jump to and briefly highlight the original.
            </P>
            <SubHeading>Emoji Reactions</SubHeading>
            <P>
              Hover a message and click the smiley face icon to add a reaction. A quick row of common emojis
              appears first; click the grid icon to open the full emoji picker. Click an existing reaction
              badge to add your own or remove yours.
            </P>
            <SubHeading>GIFs</SubHeading>
            <P>
              Click the <strong className="text-discord-text">GIF</strong> button in the message input toolbar
              to open the GIF picker. A selection of trending GIFs is shown by default. Type in the search
              box to find GIFs by keyword. Click any GIF to send it instantly into the conversation.
            </P>
            <SubHeading>Pinned Messages</SubHeading>
            <P>
              Server owners and admins can pin important messages by hovering the message and clicking the
              pin icon. Pinned messages are accessible via the pin icon in the channel header. Click a pinned
              message preview to jump to it in the chat history. Admins can unpin from the same panel.
            </P>
            <SubHeading>Typing Indicators</SubHeading>
            <P>
              When someone is actively typing in a channel you are viewing, their name appears in small
              text below the message input. The indicator disappears 1.5 seconds after they stop typing.
            </P>
            <SubHeading>Message History</SubHeading>
            <P>
              Channels load the 50 most recent messages. Scroll to the top of the list to automatically
              load older messages in batches of 50. The scroll position is preserved so you can keep
              reading without being snapped back to the bottom.
            </P>
            <SubHeading>Media & Links</SubHeading>
            <P>Messages automatically render:</P>
            <ul className="list-disc list-inside text-discord-muted text-sm space-y-1.5 mb-4 ml-2">
              <li>Image URLs ending in <strong className="text-discord-text">.png, .jpg, .gif, .webp</strong>, etc. display as inline images (max height 288 px).</li>
              <li>YouTube links (youtube.com/watch, youtu.be, shorts, etc.) render as embedded players.</li>
              <li>Other URLs show a <strong className="text-discord-text">link preview card</strong> with the site's title, description, and thumbnail image (when available).</li>
            </ul>

            <hr className="border-discord-darker my-8" />

            {/* ── Mentions & Search ── */}
            <SectionHeading id="mentions">Mentions & Search</SectionHeading>
            <SubHeading>@Mentions</SubHeading>
            <P>
              Type <strong className="text-discord-text">@</strong> in the message box to bring up an
              autocomplete list of server members. Continue typing to filter by name. Use{' '}
              <Kbd>↑</Kbd> / <Kbd>↓</Kbd> arrow keys to navigate the list and <Kbd>Enter</Kbd> or{' '}
              <Kbd>Tab</Kbd> to select. You can also type <strong className="text-discord-text">@everyone</strong> to
              notify all members in the channel.
            </P>
            <SubHeading>Mention Highlighting</SubHeading>
            <P>
              When a message contains an @mention:
            </P>
            <ul className="list-disc list-inside text-discord-muted text-sm space-y-1.5 mb-4 ml-2">
              <li>Mentions of <strong className="text-discord-text">your own name</strong> are highlighted in yellow.</li>
              <li>Mentions of <strong className="text-discord-text">other users</strong> appear highlighted in blue.</li>
            </ul>
            <SubHeading>Message Search</SubHeading>
            <P>
              Click the magnifying glass icon in the channel header to open the search bar. Type to search
              messages in the current channel — results update as you type. Click any result to jump
              directly to that message in the chat history, which will scroll into view and briefly highlight.
            </P>
            <NoteBox>
              Message search only searches within the currently open channel or DM conversation.
            </NoteBox>

            <hr className="border-discord-darker my-8" />

            {/* ── Polls ── */}
            <SectionHeading id="polls">Polls</SectionHeading>
            <P>
              Polls let you ask a question and collect votes from everyone in a text channel. Results
              update in real time as people vote.
            </P>
            <SubHeading>Creating a Poll</SubHeading>
            <P>
              Click the bar-chart icon in the message input toolbar (not available in DMs). A poll
              composer appears above the input with the following fields:
            </P>
            <Table
              headers={['Field', 'Details']}
              rows={[
                ['Question',         'What you want to ask. Up to 300 characters.'],
                ['Options',          'Between 2 and 10 answer choices. Press Enter in an option field to add the next one.'],
                ['Multiple choices', 'Toggle this on to let people vote for more than one option at once.'],
              ]}
            />
            <P>
              Click <strong className="text-discord-text">Create Poll</strong> when ready. The poll
              is sent as a message in the channel.
            </P>
            <SubHeading>Voting</SubHeading>
            <P>
              Click any option to cast your vote. If multiple choices are allowed you can select as
              many options as you like — clicking a selected option again removes your vote for it.
              The vote bars and percentages update instantly for everyone in the channel.
            </P>
            <SubHeading>Ending a Poll</SubHeading>
            <P>
              The person who created a poll and server owners/admins can end it by clicking the{' '}
              <strong className="text-discord-text">End</strong> button in the top-right corner of
              the poll. Once ended, voting is disabled and the poll is marked as <em>Poll ended</em>.
              Final results remain visible.
            </P>
            <NoteBox>
              Polls are only available in server text channels, not in Direct Messages.
            </NoteBox>

            <hr className="border-discord-darker my-8" />

            {/* ── Formatting ── */}
            <SectionHeading id="formatting">Text Formatting</SectionHeading>
            <P>
              Messages support a subset of Markdown. Use the formatting toolbar in the message input
              (hover the <strong className="text-discord-text">T</strong> icon to reveal the buttons) or type
              the syntax directly.
            </P>
            <Table
              headers={['Style', 'Syntax', 'Result']}
              rows={[
                ['Bold',          '**text**',   <strong>text</strong>],
                ['Italic',        '*text*',     <em>text</em>],
                ['Underline',     '__text__',   <u>text</u>],
                ['Strikethrough', '~~text~~',   <s>text</s>],
                ['Inline code',   '`text`',     <code className="bg-discord-darker/70 px-1 py-0.5 rounded text-xs font-mono">text</code>],
              ]}
            />
            <TipBox>
              Select text before clicking a toolbar button to wrap the selection. Click without a selection
              to insert the syntax markers and place the cursor between them.
            </TipBox>

            <hr className="border-discord-darker my-8" />

            {/* ── Canvas Channels ── */}
            <SectionHeading id="canvas">Canvas Channels</SectionHeading>
            <P>
              Canvas channels are a shared whiteboard where everyone in a server can draw together in
              real time. Strokes from all members appear instantly and are saved — the canvas looks the
              same whether you visit it now or come back later.
            </P>
            <SubHeading>Creating a Canvas Channel</SubHeading>
            <P>
              Owners and admins can click the <strong className="text-discord-text">+</strong> button next to
              the <strong className="text-discord-text">Canvas Channels</strong> heading in the sidebar and give
              the channel a name.
            </P>
            <SubHeading>Drawing Tools</SubHeading>
            <Table
              headers={['Tool', 'How to use']}
              rows={[
                ['Pen',    'Click the pen icon (or select any color swatch) to draw freehand lines.'],
                ['Eraser', 'Click the eraser icon to remove parts of the drawing.'],
                ['Colors', 'Pick one of nine preset swatches, or click the color picker square for any custom color.'],
                ['Size',   'Drag the Size slider to change the brush or eraser width (1–40).'],
              ]}
            />
            <SubHeading>Clearing the Canvas</SubHeading>
            <P>
              Server owners and admins see a <strong className="text-discord-text">Clear Canvas</strong> button
              in the toolbar. Clicking it asks for confirmation, then permanently removes all strokes for
              every member in the channel.
            </P>
            <NoteBox>
              The canvas has a maximum of 5,000 strokes. Once that limit is reached, new strokes are
              dropped until an admin clears the canvas.
            </NoteBox>

            <hr className="border-discord-darker my-8" />

            {/* ── Voice & Video ── */}
            <SectionHeading id="voice-video">Voice & Video</SectionHeading>
            <SubHeading>Joining a Voice Channel</SubHeading>
            <P>
              Click any voice channel in the sidebar to join it. You will be shown a participant grid. If
              you were already in a different voice channel you are moved automatically.
            </P>
            <SubHeading>Controls</SubHeading>
            <Table
              headers={['Button', 'Action']}
              rows={[
                ['Microphone',   'Mute / unmute your microphone.'],
                ['Camera',       'Enable / disable your webcam.'],
                ['Screen',       'Start / stop screen sharing (see below).'],
                ['Leave (red)',  'Disconnect from the voice channel.'],
              ]}
            />
            <SubHeading>Screen Sharing</SubHeading>
            <P>
              Click the screen icon in the voice controls to start sharing. Your browser will ask you to
              select a window, tab, or your entire screen. Once sharing, other participants see your screen
              in a large display area at the top of the voice view.
            </P>
            <P>
              To view a shared screen full-screen, double-click the preview area or click the expand button
              that appears in the top-right corner on hover. Press <Kbd>Esc</Kbd> or double-click again to exit.
            </P>
            <NoteBox>
              Only one screen share is active in a room at a time. The local user's share takes priority in the display.
            </NoteBox>
            <SubHeading>Sound Effects</SubHeading>
            <P>Voice channel events play short synthesized audio cues:</P>
            <Table
              headers={['Event', 'Sound']}
              rows={[
                ['You join a voice channel',           'Ascending two-note chime.'],
                ['You leave a voice channel',          'Descending two-note chime.'],
                ['Someone else joins your channel',   'Short high blip.'],
                ['Someone else leaves your channel',  'Short low blip.'],
                ['New message in the current channel or DM', 'Three-note notification chime (only plays for messages from others).'],
              ]}
            />
            <NoteBox>
              Sounds are generated using the Web Audio API — no audio files are downloaded. They will only play after you have interacted with the page (browser autoplay policy).
            </NoteBox>

            <hr className="border-discord-darker my-8" />

            {/* ── Direct Messages ── */}
            <SectionHeading id="direct-messages">Direct Messages</SectionHeading>
            <SubHeading>Opening a DM</SubHeading>
            <P>
              Click the <strong className="text-discord-text">Direct Messages</strong> icon (house) at the top
              of the server sidebar to go to the DM view. Your existing conversations are listed on the left.
              Click a conversation to open it, or use the search/add button to start a new one.
            </P>
            <P>
              You can also start a DM directly from any user's profile page or hover card by clicking
              the <strong className="text-discord-text">Send Message</strong> button.
            </P>
            <SubHeading>Voice Calls in DMs</SubHeading>
            <P>
              Open a DM conversation and click the phone icon in the header to call the other person. They
              receive an incoming call notification with <strong className="text-discord-text">Accept</strong> and{' '}
              <strong className="text-discord-text">Decline</strong> buttons. Once the call is accepted:
            </P>
            <ul className="list-disc list-inside text-discord-muted text-sm space-y-1.5 mb-4 ml-2">
              <li>A compact call bar appears at the bottom of the screen.</li>
              <li>Mute, camera, screen share, and hang-up controls are in the call bar.</li>
              <li>If either person starts screen sharing a floating preview window appears, which can be resized to full screen.</li>
            </ul>
            <P>
              Hanging up via the red button ends the call for both parties. Navigating away does not end the call.
            </P>

            <hr className="border-discord-darker my-8" />

            {/* ── Status ── */}
            <SectionHeading id="status">Status</SectionHeading>
            <P>
              Your status is shown as a coloured dot on your avatar throughout the app.
            </P>
            <Table
              headers={['Status', 'Colour', 'Meaning']}
              rows={[
                ['Online',         '🟢 Green',  'Active and available.'],
                ['Away',           '🟡 Yellow', 'Idle — set manually or automatically after inactivity.'],
                ['Do Not Disturb', '🔴 Red',    'Available but wants fewer interruptions. Set manually.'],
                ['Offline',        '⚫ Grey',   'Disconnected or set manually to appear offline.'],
              ]}
            />
            <P>
              Click your avatar in the bottom-left user panel to open the status menu and choose a status.
              Your status is set to <strong className="text-discord-text">Online</strong> automatically when
              you connect and <strong className="text-discord-text">Offline</strong> when you disconnect.
            </P>

            <hr className="border-discord-darker my-8" />

            {/* ── Notifications ── */}
            <SectionHeading id="notifications">Notifications</SectionHeading>
            <SubHeading>Unread Badges</SubHeading>
            <P>
              Text channels with new messages you haven't read appear bold with a white dot in the sidebar.
              DM conversations with unread messages show a red badge on the DM icon.
            </P>
            <SubHeading>Browser Notifications</SubHeading>
            <P>
              When the app tab is not active, new messages in channels or DMs trigger a browser notification
              showing the sender's name and a preview of the message. Clicking the notification opens the
              relevant conversation.
            </P>
            <TipBox>
              Your browser will ask for notification permission the first time you log in. You must grant
              permission to receive these alerts. You can update this at any time in your browser settings.
            </TipBox>

            <hr className="border-discord-darker my-8" />

            {/* ── User Settings ── */}
            <SectionHeading id="user-settings">User Settings</SectionHeading>
            <P>
              Click the gear icon in the bottom-left user panel to open your settings.
            </P>
            <SubHeading>Profile</SubHeading>
            <P>
              Your profile is visible to all users who hover your name or visit your profile page. The
              following fields can be customized:
            </P>
            <Table
              headers={['Field', 'Details']}
              rows={[
                ['Avatar',        'Upload a profile picture. Images are resized to 256×256 px. Supported: JPEG, PNG, WebP, GIF. You can also remove your current avatar to reset to the default.'],
                ['Username',      'Your display name (2–32 characters, letters/numbers/underscores/hyphens/periods only).'],
                ['Pronouns',      'Shown under your username on your profile. Up to 40 characters.'],
                ['Bio',           'A short description about yourself shown on your profile page. Up to 500 characters.'],
                ['Location',      'Your city, country, or anywhere you want. Shown on your profile. Up to 100 characters.'],
                ['Banner color',  'A color that fills the banner area at the top of your profile card. Click the color swatch to pick a custom color.'],
                ['Email',         'The email address associated with your account.'],
              ]}
            />
            <SubHeading>Viewing Profiles</SubHeading>
            <P>
              Hover over any user's name or avatar in a channel to see a quick profile card with their
              bio, pronouns, location, and status. Click <strong className="text-discord-text">View Profile</strong> to
              open their full profile page, or <strong className="text-discord-text">Send Message</strong> to
              open a DM conversation with them.
            </P>
            <SubHeading>Security</SubHeading>
            <P>
              You can change your password from the settings page. You must enter your current password to
              set a new one. New passwords must be at least 6 characters.
            </P>

            <hr className="border-discord-darker my-8" />

            {/* ── Steve 2.0 ── */}
            <SectionHeading id="steve">Steve 2.0</SectionHeading>
            <P>
              Steve 2.0 is an AI bot that hangs out in text channels and DMs. He's a 30-year-old
              midwesterner working at a county detention center while attending police academy. He has
              strong opinions, zero self-awareness, and a complicated relationship with the Roman Empire.
            </P>
            <SubHeading>How He Works</SubHeading>
            <ul className="list-disc list-inside text-discord-muted text-sm space-y-1.5 mb-4 ml-2">
              <li>In text channels, Steve has a <strong className="text-discord-text">40% chance</strong> of responding to any message, and a <strong className="text-discord-text">95% chance</strong> if the message mentions him by name or ends with a question mark.</li>
              <li>He occasionally starts conversations on his own if a channel has been quiet for 10–25 minutes.</li>
              <li>Sometimes he reacts to messages with an emoji instead of replying.</li>
              <li>He responds to all <strong className="text-discord-text">Direct Messages</strong> you send him.</li>
              <li>A typing indicator appears while he is composing his response.</li>
            </ul>
            <SubHeading>Enabling Steve</SubHeading>
            <P>
              Steve must be enabled per-server. As a server owner or admin, open{' '}
              <strong className="text-discord-text">Server Settings</strong> (gear icon in the server header)
              and toggle <strong className="text-discord-text">Steve 2.0</strong> on. He will show as online
              in your member list and DM list once enabled.
            </P>
            <TipBox>
              Steve is powered by Claude (claude-haiku-4-5) and reads the last 20 messages in a channel
              for context before responding.
            </TipBox>

            <hr className="border-discord-darker my-8" />

            {/* ── About ── */}
            <SectionHeading id="about">About</SectionHeading>
            <div className="flex items-center gap-4 mb-8">
              <img src="/favicon.svg" alt="logo" className="w-14 h-14 rounded-xl" />
              <div>
                <h3 className="text-white text-xl font-bold">CompuGlobalHyperMegaNet</h3>
                <p className="text-discord-muted text-sm mt-0.5">Version {APP_VERSION}</p>
              </div>
            </div>

            <SubHeading>Frontend</SubHeading>
            <VersionTable rows={CLIENT_DEPS} />

            <SubHeading>Backend</SubHeading>
            <VersionTable rows={SERVER_DEPS} />

            <SubHeading>Legal</SubHeading>
            <div className="bg-discord-darker rounded-lg px-4 py-4 text-sm text-discord-muted space-y-3 leading-relaxed">
              <p>Copyright &copy; {new Date().getFullYear()} Flancrest Enterprises. All rights reserved.</p>
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
                WebRTC functionality is provided by <span className="text-discord-text">simple-peer</span> (MIT License).
                Emoji data is provided by <span className="text-discord-text">emoji-mart</span> (MIT License).
              </p>
            </div>

            <div className="h-16" />
          </div>
        </main>
      </div>
    </div>
  );
}
