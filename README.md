# Truck Viz

Interactive **3D truck visualization** built with React and [React Three Fiber](https://docs.pmnd.rs/react-three-fiber/getting-started/introduction). A GLB model drives brake and headlight materials, wheel rotation from speed, subtle suspension “rumble” at higher speeds, and optional selective bloom on the headlights. A small **Express API** keeps lighting and speed in sync so you can wire in real telemetry or control surfaces later.

---

## Features

- **Orbit camera** — drag to orbit, scroll to zoom (damped controls).
- **Lighting** — brake/tail and headlight toggles update both the 3D scene and server state.
- **Speed** — slider roughly −30…30; wheels spin proportionally; above a threshold, motion adds suspension-style movement.
- **HUD** — vehicle controls, link status to the API, and a compact event log (sync, lights, speed posts, link up/down).
- **Dev overlay** — optional “toy perception” (cone + lidar-style lines) for demos.
- **Deployment-ready** — Vite dev proxy for local API; `VITE_API_URL` for production static hosting; CORS configured on the API via `FRONTEND_URL`.

---

## Stack

| Layer    | Choice |
| -------- | ------ |
| UI       | React 18, Vite 6 |
| 3D       | Three.js, `@react-three/fiber`, `@react-three/drei`, `@react-three/postprocessing` |
| API      | Express 5, `cors` |

---

## Prerequisites

- **Node.js 20** (matches [Render](https://render.com) config in `render.yaml`)

---

## Local development

1. **Install dependencies**

   ```bash
   npm install
   ```

2. **Start the API** (port **3001** by default)

   ```bash
   npm run server
   ```

3. **Start the Vite dev server** (in another terminal)

   ```bash
   npm run dev
   ```

   Vite proxies `GET /state`, `POST /lights/*`, and `POST /truck/speed` to `http://localhost:3001`, so the browser can call same-origin paths while developing.

4. Open the URL Vite prints (usually `http://localhost:5173`). The truck model is served from `public/truck.glb`.

---

## Environment variables

Copy `.env.example` and adjust for your hosts.

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `VITE_API_URL` | Frontend build (e.g. Vercel) | Public origin of the API, **no trailing slash**. Empty in local dev uses the Vite proxy. |
| `FRONTEND_URL` | API (e.g. Render) | Comma-separated allowed origins for CORS. If unset, the API allows all origins (fine for local-only use). |

---

## API reference

Base URL: local `http://localhost:3001`, or your deployed API. State is **in-memory** and resets when the server restarts.

| Method | Path | Body | Description |
| ------ | ---- | ---- | ----------- |
| `GET` | `/` | — | Health: `{ ok, service }` |
| `GET` | `/state` | — | `{ brakeOn, headOn, speed }` |
| `POST` | `/lights/brake` | `{ "on": boolean }` optional — omit toggles | Update brake lights |
| `POST` | `/lights/head` | `{ "on": boolean }` optional — omit toggles | Update headlights |
| `POST` | `/truck/speed` | `{ "speed": number }` required | Update speed |

Successful POSTs return `{ ok: true, brakeOn, headOn, speed }`.

---

## Production deployment (example)

Typical split:

1. **Frontend** — Build with `npm run build` and host the `dist` output (e.g. [Vercel](https://vercel.com) with `vercel.json` SPA rewrites). Set `VITE_API_URL` to your API origin at build time.
2. **API** — Run `npm run server` on a Node host (e.g. [Render](https://render.com) using `render.yaml`). Set `FRONTEND_URL` to your production site URL(s).

---

## Scripts

| Command | Description |
| ------- | ----------- |
| `npm run dev` | Vite dev server with API proxy |
| `npm run build` | Production build → `dist/` |
| `npm run preview` | Preview production build (proxy config matches dev) |
| `npm run server` | Express API on `PORT` or `3001` |

---

## Project layout

```
├── public/truck.glb   # 3D model (replaceable; mesh names in App.jsx must match)
├── server.js          # Express API
├── src/App.jsx        # Scene, HUD, API client
├── src/index.css
├── vite.config.js     # Dev/preview proxy (avoid proxying `/truck` — would shadow `truck.glb`)
├── vercel.json
└── render.yaml
```

---

## License

Private project (`"private": true` in `package.json`). Adjust as needed if you open-source it.
