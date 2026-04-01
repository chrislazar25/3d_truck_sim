# Truck Viz

> Interactive vehicle state in the browser: a **GLB truck** in React Three Fiber, **lighting and speed** driven from a small **Express API**, with soft shadows, selective bloom, and a minimal HUD.

---

### Highlights

- **3D scene** — Orbit controls, environment lighting, wheel rotation from speed, subtle chassis motion at higher speeds.
- **Lights** — Brake and headlight meshes respond to toggles; state stays aligned with the server.
- **API** — In-memory `brakeOn`, `headOn`, and `speed`; the UI polls health and debounces speed writes.
- **Extras** — Optional perception overlay (cone + scan lines) for visualization demos.

---

### Stack

React 18 · Vite 6 · Three.js · `@react-three/fiber` · `@react-three/drei` · `@react-three/postprocessing` · Express 5

---

### Run locally

**Requires Node.js 20.**

```bash
npm install
```

Terminal 1 — API (default port `3001`):

```bash
npm run server
```

Terminal 2 — app:

```bash
npm run dev
```

Open the URL Vite prints (typically `http://localhost:5173`). The model lives at `public/truck.glb`. Same-origin requests in dev are proxied to the API (`/state`, `/lights/*`, `/truck/speed`).

---

### Environment (optional)

For a static build that talks to an API on another origin, set `VITE_API_URL` to that origin with **no trailing slash**. See `.env.example`.

On the server, `FRONTEND_URL` can be a comma-separated allowlist for CORS; if unset, all origins are allowed (convenient for local work).

---

### API

In-memory state; resets when the server restarts.

| Endpoint | Description |
| --- | --- |
| `GET /` | Health: `{ ok, service }` |
| `GET /state` | `{ brakeOn, headOn, speed }` |
| `POST /lights/brake` | `{ "on": boolean }` optional (omit body to toggle) |
| `POST /lights/head` | same |
| `POST /truck/speed` | `{ "speed": number }` required |

Successful `POST` responses: `{ ok: true, brakeOn, headOn, speed }`.

---

### Scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Vite dev server + API proxy |
| `npm run build` | Output to `dist/` |
| `npm run preview` | Preview `dist/` (proxy unchanged) |
| `npm run server` | API on `PORT` or `3001` |

---

### Layout

```
public/truck.glb
server.js
src/App.jsx          — scene, materials, HUD, client
src/index.css
vite.config.js       — proxy; `/truck/*` is not proxied so `truck.glb` stays reachable
```
