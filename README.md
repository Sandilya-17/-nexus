# 🚀 Nexus — Enterprise Team Communication Platform

A full-featured, enterprise-grade team communication PWA with real-time messaging, audio/video calls, status updates, and more.

---

## ✨ Features

### 💬 Messaging
- Real-time direct and group messages (Socket.IO)
- Text, images, videos, audio, voice messages, files (up to 50MB)
- Message reactions (emoji), replies, forwarding, mentions (@user)
- Edit messages (within 15 min), delete for me / delete for everyone
- Read receipts + delivery receipts
- Typing indicators
- Starred messages
- Polls with multiple choice support
- Message search (full-text)
- Infinite scroll with lazy loading
- Drag & drop file upload
- Disappearing messages (per group setting)
- Pinned messages

### 👥 Groups & Channels
- Create groups with avatar, name, description
- Member roles: owner, admin, member
- Admin controls: restrict messaging, adding members, editing info
- Invite links (join via URL)
- Kick/leave/transfer ownership
- Group settings panel

### 📞 Audio & Video Calls
- 1-on-1 and group WebRTC calls
- Toggle mic, camera, screen sharing
- Minimizable call overlay
- Call history with duration
- Incoming call notifications with ringtone
- TURN server support for NAT traversal

### 🔴 Status Updates
- Post text (with background colors), photo, or video status
- Stories disappear after 24 hours
- View receipts, emoji reactions, reply to status
- Privacy: everyone / contacts / selected users

### 🔒 Security & Privacy
- JWT auth with refresh tokens
- Password hashing (bcrypt, cost 12)
- Rate limiting (auth: 20/15min, API: 200/min)
- Helmet security headers
- Block users
- Privacy controls (last seen, read receipts, profile photo)
- Two-factor auth ready (schema)

### 📱 PWA
- Installable on desktop and mobile
- Offline-capable (Workbox service worker)
- Push notification support
- Web app shortcuts
- Safe area insets (iOS)
- Mobile keyboard handling

### 🛡️ Admin Dashboard
- User management (activate/deactivate, role change)
- System stats (users, messages, chats, online count)
- Full-text search across users

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion |
| State | Zustand |
| Real-time | Socket.IO |
| Backend | Node.js, Express |
| Database | MongoDB (Mongoose) |
| Cache | Redis |
| File Storage | Cloudinary |
| Auth | JWT + Refresh Tokens |
| Calls | WebRTC (native browser API) |
| PWA | Vite PWA Plugin (Workbox) |
| Deploy | Railway / Docker |

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- MongoDB Atlas account (free tier works)
- Cloudinary account (free tier works)
- Railway account (for deployment)

### Local Development

```bash
# Clone / extract the project
cd nexus

# Backend setup
cd backend
cp .env.example .env
# Edit .env with your MongoDB URI, Cloudinary keys, etc.
npm install
npm run dev

# Frontend setup (new terminal)
cd ../frontend
cp .env.example .env
# Edit .env — set VITE_API_URL=http://localhost:5000/api
npm install
npm start
```

Open http://localhost:3000

### Docker (all-in-one)

```bash
cp backend/.env.example backend/.env
# Edit backend/.env

docker-compose up -d
```

---

## 🚂 Deploy to Railway

### Backend

1. Create a new Railway project
2. Add service → "Deploy from GitHub" (or push code)
3. Set the root directory to `backend/`
4. Add all environment variables from `.env.example`
5. Add a MongoDB plugin or use MongoDB Atlas URI
6. Add a Redis plugin or use Redis Cloud URI
7. Railway auto-detects the Dockerfile

### Frontend

1. Add another Railway service
2. Root directory: `frontend/`
3. Set `VITE_API_URL` and `VITE_SOCKET_URL` to your backend Railway URL
4. Railway builds with the Dockerfile

### One-click variables for Railway backend:
```
NODE_ENV=production
PORT=5000
MONGODB_URI=<from MongoDB Atlas>
JWT_SECRET=<generate: openssl rand -hex 32>
JWT_REFRESH_SECRET=<generate: openssl rand -hex 32>
CLOUDINARY_CLOUD_NAME=<from cloudinary.com>
CLOUDINARY_API_KEY=<from cloudinary.com>
CLOUDINARY_API_SECRET=<from cloudinary.com>
CLIENT_URL=<your frontend Railway URL>
```

---

## 📁 Project Structure

```
nexus/
├── backend/
│   ├── src/
│   │   ├── controllers/    # Business logic
│   │   ├── models/         # MongoDB schemas
│   │   ├── routes/         # Express routes
│   │   ├── middleware/     # Auth, upload, rate limit, error
│   │   ├── socket/         # Socket.IO events
│   │   └── utils/          # DB, logger helpers
│   ├── Dockerfile
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── chat/       # ChatList, ChatWindow, MessageBubble, MessageInput
│   │   │   ├── calls/      # ActiveCallOverlay, IncomingCallModal
│   │   │   ├── layout/     # MainLayout, Sidebar
│   │   │   └── ui/         # Avatar, Badge, etc.
│   │   ├── pages/          # ChatsPage, StatusPage, CallsPage, Settings, Admin
│   │   ├── context/        # Zustand stores (auth, chat, calls)
│   │   ├── hooks/          # useSocketEvents
│   │   ├── services/       # api.js, socket.js
│   │   └── styles/         # globals.css
│   ├── Dockerfile
│   └── vite.config.js
│
├── nginx/
│   └── nginx.conf
└── docker-compose.yml
```

---

## 🌟 Features vs WhatsApp

| Feature | WhatsApp | Nexus |
|---------|----------|-------|
| Real-time messaging | ✅ | ✅ |
| Voice & video calls | ✅ | ✅ |
| Group calls | ✅ | ✅ |
| Screen sharing | ❌ | ✅ |
| File sharing (50MB) | 16MB | ✅ 50MB |
| Polls | ✅ | ✅ |
| Admin dashboard | ❌ | ✅ |
| Web app (PWA) | Limited | ✅ Full |
| Self-hosted | ❌ | ✅ |
| Open architecture | ❌ | ✅ |
| No phone number req'd | ❌ | ✅ |
| Department/role fields | ❌ | ✅ |
| Message search | Limited | ✅ Full-text |
| Disappearing msgs | ✅ | ✅ |
| Read receipts ctrl | ✅ | ✅ |
| Invite links | ✅ | ✅ |

---

## 📄 License

MIT — use freely for commercial projects.
# -nexus
