# Study With Me | ادرس معي

A full-stack video conferencing and collaboration platform for virtual study rooms, built with Django + React. Features real-time video/audio (WebRTC), chat (WebSockets), and participant management with an Arabic RTL interface.

| English | العربية |
|---------|---------|
| A collaborative study platform | منصة تعاونية للدراسة عن بعد |
| Real-time video/audio rooms | غرف فيديو وصوت تفاعلية |
| WebRTC peer-to-peer streaming | بث مباشر بين المشاركين |
| Arabic RTL interface | واجهة عربية كاملة |

## Tech Stack

### Backend
- **Python 3.12** + **Django 6.0**
- **Django REST Framework** - RESTful API
- **Django Channels** + **Daphne** - WebSocket support
- **SimpleJWT** - JWT authentication
- **SQLite** - Database

### Frontend
- **React 18** + **Vite 5**
- **Tailwind CSS 3** - Utility-first styling
- **React Router 6** - Client-side routing
- **Axios** - HTTP client with JWT interceptors
- **WebRTC** - Peer-to-peer video/audio
- **WebSocket** - Real-time chat & signaling

## Features

- User registration and JWT-based authentication
- Create and join meeting rooms with unique 6-character codes
- Real-time video/audio communication via WebRTC (STUN)
- Text chat with instant messaging
- Emoji reactions with full-screen animations
- Raise hand functionality with notifications
- Host controls: mute, kick participants, lock/unlock rooms
- RTL (Right-to-Left) Arabic interface
- Responsive design with glassmorphism UI
- Participant list with live status updates
- Camera starts off by default for privacy
- Join notification sound (Web Audio API)




<img width="895" height="918" alt="image" src="https://github.com/user-attachments/assets/ff2028e5-cefe-4547-8de8-5e640dd8a870" />

<img width="1844" height="955" alt="image" src="https://github.com/user-attachments/assets/6e498888-50d9-40d5-87c7-26239c471af2" />
<img width="1898" height="962" alt="{DBA63919-3DDB-43FB-AD88-AB1C87D76228}" src="https://github.com/user-attachments/assets/07f16563-5dd3-447e-8af1-b8ca829976dd" />















## Installation

### Prerequisites
- Python 3.12+
- Node.js 18+

### Backend Setup

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/study-with-me.git
cd study-with-me

# Create and activate virtual environment
python -m venv venv
.\venv\Scripts\Activate.ps1  # Windows
# source venv/bin/activate   # Linux/macOS

# Install dependencies
pip install -r requirements.txt

# Apply migrations
python manage.py migrate

# Create superuser (optional)
python manage.py createsuperuser

# Start the Django server
python manage.py runserver
```

### Frontend Setup

```bash
cd Frontend
npm install
npm run dev
```

The app will be available at `http://localhost:5173` (frontend) with API proxied to `http://localhost:8000` (backend).

## Project Structure

```
Zoom/
├── Core/                    # Django project configuration
│   ├── settings.py         # App settings (CORS, JWT, Channels, etc.)
│   ├── urls.py             # Root URL routing
│   ├── asgi.py             # ASGI config (WebSocket routing)
│   └── wsgi.py             # WSGI config
├── accounts/               # User authentication app
│   ├── models.py           # Custom User model
│   ├── serializers.py      # DRF serializers
│   ├── views.py            # Auth API views
│   └── urls.py             # Auth routes
├── rooms/                  # Meeting rooms app
│   ├── models.py           # Room & Participant models
│   ├── serializers.py      # DRF serializers
│   ├── views.py            # Room API views
│   ├── consumers.py        # WebSocket consumers (chat + WebRTC)
│   ├── routing.py          # WebSocket URL routing
│   └── urls.py             # REST API routes
├── Frontend/               # React + Vite frontend
│   ├── src/
│   │   ├── pages/          # Login, Register, Dashboard, Room
│   │   ├── components/     # PrivateRoute
│   │   ├── contexts/       # AuthContext (JWT management)
│   │   └── services/       # Axios API client
│   └── ...
├── manage.py               # Django CLI
└── requirements.txt        # Python dependencies
```

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/accounts/register/` | Register new user |
| POST | `/api/accounts/login/` | Login |
| GET | `/api/accounts/profile/` | Get user profile |
| POST | `/api/accounts/logout/` | Logout |
| POST | `/api/rooms/create/` | Create a room |
| POST | `/api/rooms/join/` | Join a room by code |
| GET | `/api/rooms/my-rooms/` | List user's rooms |
| GET | `/api/rooms/:code/` | Room details |
| POST | `/api/rooms/:code/leave/` | Leave a room |
| POST | `/api/rooms/:code/hand/` | Toggle raise hand |
| POST | `/api/rooms/:code/mute/` | Mute a participant (host) |
| POST | `/api/rooms/:code/kick/` | Kick a participant (host) |
| POST | `/api/rooms/:code/lock/` | Toggle lock room (host) |

### WebSocket Endpoints
| Endpoint | Purpose |
|----------|---------|
| `/ws/chat/:code/` | Real-time chat & notifications |
| `/ws/webrtc/:code/` | WebRTC signaling |

## Architecture

```
Browser ─── HTTP (Axios) ──> Vite Proxy ──> Django REST API (:8000)
              │                                  │
              ├── /api/auth/*                     │
              ├── /api/rooms/*                    │
              │                                  │
Browser ─── WebSocket ───> Vite Proxy ──> Django Channels (Daphne :8000)
              │                                  │
              ├── /ws/chat/:code/                  │
              ├── /ws/webrtc/:code/                │
              │                                  │
Browser ─── WebRTC (P2P) ──> Other Peers (via STUN)
```

## License

MIT
