import express from "express";
import cors from "cors";

const app = express();
const PORT = process.env.PORT ?? 3001;

const frontendOrigins = (process.env.FRONTEND_URL ?? "")
  .split(",")
  .map((s) => s.trim())
  .filter(Boolean);

/** In-memory state (resets when the server restarts). */
const state = {
  brakeOn: false,
  headOn: false,
  speed: 0,
};

app.use(
  cors({
    origin:
      frontendOrigins.length > 0
        ? frontendOrigins
        : true,
  })
);
app.use(express.json());

app.get("/", (_req, res) => {
  res.json({ ok: true, service: "truck-viz-api" });
});

function snapshot() {
  return {
    brakeOn: state.brakeOn,
    headOn: state.headOn,
    speed: state.speed,
  };
}

app.get("/state", (_req, res) => {
  res.json(snapshot());
});

app.post("/lights/brake", (req, res) => {
  const { on } = req.body ?? {};
  if (typeof on === "boolean") {
    state.brakeOn = on;
  } else {
    state.brakeOn = !state.brakeOn;
  }
  res.json({ ok: true, ...snapshot() });
});

app.post("/lights/head", (req, res) => {
  const { on } = req.body ?? {};
  if (typeof on === "boolean") {
    state.headOn = on;
  } else {
    state.headOn = !state.headOn;
  }
  res.json({ ok: true, ...snapshot() });
});

app.post("/truck/speed", (req, res) => {
  const { speed } = req.body ?? {};
  if (typeof speed !== "number" || Number.isNaN(speed)) {
    return res.status(400).json({ error: "body must include numeric speed" });
  }
  state.speed = speed;
  res.json({ ok: true, ...snapshot() });
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`API listening on port ${PORT}`);
});
