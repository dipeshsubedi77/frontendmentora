# Mentora Frontend

Modern web frontend for the **Mentora** AI tutoring platform — deployment-ready for Vercel.

Built with:

- **React 18** · **Vite** · **TypeScript** · **Tailwind CSS**
- **React Router** (client-side routing) · **Zustand** (state) · **Axios** (HTTP)
- **Recharts** · **Framer Motion** · **Socket.IO Client** · **React Flow** · **pdf.js**

---

## Quick Start

```bash
npm install

# point the app at your backend API
cp .env.example .env.local   # then edit VITE_API_URL

npm run dev                  # http://localhost:5173
```

Prerequisites: Node.js >= 18, npm >= 9.

---

## Environment Variables

| Variable       | Required | Description                                        |
|----------------|----------|----------------------------------------------------|
| `VITE_API_URL` | Yes      | Backend API **bare origin**, e.g. `http://localhost:8000`. Endpoints under `/api/v1` are appended by the client. |

Example `.env.local`:

```
VITE_API_URL=http://localhost:8000
```

### Wire up the backend

Enable CORS on the FastAPI backend for the frontend origin:

```python
origins = ["http://localhost:5173", "https://<your-app>.vercel.app"]
app.add_middleware(CORSMiddleware, allow_origins=origins, allow_credentials=True, allow_methods=["*"], allow_headers=["*"])
```

---

## Production Build

```bash
npm run build     # runs tsc + vite build → dist/
npm run preview   # serve the production build locally
```

---

## Deploy to Vercel (Git)

The repo is pre-configured for Vercel via `vercel.json` (SPA rewrites included), so a normal **Git import** works:

1. In the [Vercel dashboard](https://vercel.com), click **Add New → Project → Import Git Repository** and pick this repository.
2. Vercel auto-detects the **Vite** framework (`build` → `npm run build`, output → `dist`).
3. Add the environment variable **`VITE_API_URL`** → your deployed backend origin (e.g. `https://mentora-backend.onrender.com`).
4. Click **Deploy**.

> Note: `.env.production` is intentionally not committed. Backend URLs are injected via **Vercel environment variables** so preview/deploy branches can each target their own backend.

### Local deploy via CLI (optional)

```bash
npm i -g vercel
vercel env add VITE_API_URL production   # https://mentora-backend.onrender.com
vercel --prod
```

---

## About this repository

CI-ready. This repo intentionally contains **only the frontend**. To enable CI builds you may want to add a `vercel/` dashboard-managed webhook or a GitHub Action against the `main` branch — Vercel's Git import handles this automatically.