# NightQuest

> A dark-sky planner for casual amateur stargazers.

## Stack

| Layer    | Technology                          |
|----------|-------------------------------------|
| Frontend | React Native Expo (TypeScript)       |
| Backend  | Python / Agno + FastAPI              |
| State    | Zustand (context object)             |
| Routing  | Expo Router (file-based)             |
| Styling  | Theme B: Atacama Desert Night        |

---

## Local Development

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate        # Windows: .venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env             # add OPENAI_API_KEY
uvicorn api:app --reload --port 8000
```

### Frontend

```bash
cd frontend
cp .env.example .env             # set EXPO_PUBLIC_API_URL=http://localhost:8000
npm install
npm run web        # browser dev
npm run android    # Android emulator
npm run ios        # iOS simulator (macOS only)
```

---

## Environment Variables

### Backend (`backend/.env`)
```
OPENAI_API_KEY=sk-...
PORT=8000
CORS_ORIGINS=http://localhost:8081
```

### Frontend (`frontend/.env`)
```
EXPO_PUBLIC_API_URL=http://localhost:8000
```

---

## Deployment

- **Backend** → Railway (auto-deploys on push to main)
- **Frontend** → Vercel (auto-deploys on push to main)

See Phase 2.11 in the implementation plan for one-time setup steps.

---

## Phase Status

| Phase | Description                        | Status      |
|-------|------------------------------------|-------------|
| 1     | Backend Foundation                 | ✅ Complete |
| 2     | Explore Tab + Context Object       | ✅ Complete |
| 3A    | Stargaze Tab: Spot Finder          | Pending     |
| 3B    | Stargaze Tab: Conditions           | Pending     |
| 4     | AI Chat                            | Pending     |
| 5     | Full Integration + Polish          | Pending     |
