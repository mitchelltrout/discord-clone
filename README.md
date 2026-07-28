# Discord Clone

A self-hosted chat platform — text channels, DMs, and peer-to-peer voice and
video — for a group that would rather not hand its conversations to a company.

**Stack:** Next.js · Node.js · Socket.io · WebRTC · SQLite · Electron

## What it does

Servers, channels, invite codes, roles, direct messages, typing indicators,
edit and delete — the shape you'd expect.

Voice and video are the part worth pointing at: they run **peer-to-peer over
WebRTC**, so media never transits the server. That keeps bandwidth costs at
roughly zero for a self-hoster, which is what makes running this on a home
server realistic at all. The server handles signalling and text over Socket.io;
media goes direct between clients.

Auth is JWT-based. There's also an Electron wrapper for a desktop client, and a
Caddyfile for putting it behind HTTPS.

## Running it

```bash
cd server && npm install && npm start
cd client && npm install && npm run dev
```

Full first-time setup, including Windows helper scripts, is below.

## Status

Working — text, voice, video, and DMs all functional. A learning project in
real-time systems as much as a chat app.

---

## Features

- **Text channels** — Real-time messaging in server channels with typing indicators, edit & delete
- **Voice channels** — WebRTC peer-to-peer voice and video (no server bandwidth used for media)
- **Direct messages** — Private 1-on-1 conversations
- **Servers** — Create servers, invite friends via invite code, manage channels
- **Authentication** — Secure JWT-based login and registration

## Setup (First Time)

### 1. Install Node.js

Download and install **Node.js LTS** from https://nodejs.org

After installing, restart any open terminals.

### 2. Run the setup script

Open PowerShell and run:

```powershell
cd C:\Users\Mitchell\Projects\discord-clone
powershell -ExecutionPolicy Bypass -File setup.ps1
```

This will install all dependencies and create the database automatically.

## Running the App

You need **two terminal windows** — one for the backend, one for the frontend.

**Terminal 1 — Backend:**
```powershell
cd C:\Users\Mitchell\Projects\discord-clone\server
node index.js
```

**Terminal 2 — Frontend:**
```powershell
cd C:\Users\Mitchell\Projects\discord-clone\client
npm run dev
```

Then open **http://localhost:3000** in your browser.

## Sharing with Friends on Your Local Network

1. Find your LAN IP: open a terminal and run `ipconfig`, look for `IPv4 Address` (e.g. `192.168.1.50`)

2. Edit `server/.env` — change `CLIENT_ORIGIN`:
   ```
   CLIENT_ORIGIN=http://192.168.1.50:3000
   ```

3. Edit `client/.env.local` — change both URLs:
   ```
   NEXT_PUBLIC_API_URL=http://192.168.1.50:4000/api
   NEXT_PUBLIC_WS_URL=http://192.168.1.50:4000
   ```

4. Restart both the server and client.

5. Friends on your Wi-Fi can now open `http://192.168.1.50:3000` in their browser.

## Project Structure

```
discord-clone/
├── server/          # Node.js + Express + Socket.io backend
│   ├── db/          # SQLite database + schema + migration
│   ├── routes/      # REST API routes (auth, servers, channels, messages, DMs)
│   ├── socket/      # Socket.io event handlers
│   ├── middleware/  # JWT auth middleware
│   ├── utils/       # JWT helpers, permission checks
│   ├── index.js     # Server entry point
│   └── .env         # Environment config
│
└── client/          # Next.js 14 frontend
    └── src/
        ├── app/     # App Router pages
        │   ├── page.js              # Root redirect
        │   ├── login/page.js        # Login page
        │   ├── register/page.js     # Register page
        │   └── channels/            # Main app routes
        │       ├── layout.js        # Auth guard + app shell
        │       ├── @me/             # DM routes
        │       └── [serverId]/      # Server/channel routes
        ├── components/
        │   ├── layout/   # AppShell, ServerSidebar, ChannelSidebar, UserPanel
        │   ├── chat/     # ChatView, MessageList, Message, MessageInput
        │   ├── voice/    # VoiceChannelView, VoiceControls, useWebRTC
        │   ├── dm/       # DMList, NewDMModal
        │   ├── server/   # CreateServerModal, JoinServerModal
        │   ├── channel/  # CreateChannelModal
        │   └── ui/       # Avatar, Modal
        └── lib/
            ├── api.js       # Axios client with JWT injection + auto-refresh
            ├── socket.js    # Socket.io client singleton
            └── stores/      # Zustand state (auth, servers, messages, voice)
```

## Tech Stack

| Layer | Tech |
|-------|------|
| Frontend | Next.js 14, Tailwind CSS, Zustand |
| Real-time | Socket.io |
| Voice/Video | WebRTC (simple-peer) |
| Backend | Node.js, Express |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (access + refresh tokens) |
