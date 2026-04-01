import { Suspense, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { Box3, BufferGeometry, DoubleSide, Float32BufferAttribute, Vector3 } from 'three';
import { EffectComposer, SelectiveBloom } from '@react-three/postprocessing';
import { OrbitControls, useGLTF, Environment, Grid } from '@react-three/drei';

const TRUCK_GLB = '/truck.glb';

/** Empty in dev (Vite proxy); set `VITE_API_URL` on Vercel to your Render backend. */
const apiBase = (import.meta.env.VITE_API_URL ?? "").replace(/\/$/, "");

const api = {
  async getState() {
    const r = await fetch(`${apiBase}/state`);
    if (!r.ok) throw new Error(`GET /state ${r.status}`);
    return r.json();
  },
  async postBrake(on) {
    const r = await fetch(`${apiBase}/lights/brake`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on }),
    });
    if (!r.ok) throw new Error(`POST /lights/brake ${r.status}`);
    return r.json();
  },
  async postHead(on) {
    const r = await fetch(`${apiBase}/lights/head`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ on }),
    });
    if (!r.ok) throw new Error(`POST /lights/head ${r.status}`);
    return r.json();
  },
  async postSpeed(speed) {
    const r = await fetch(`${apiBase}/truck/speed`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ speed }),
    });
    if (!r.ok) throw new Error(`POST /truck/speed ${r.status}`);
    return r.json();
  },
};

function applySnapshot(setters, data) {
  if (typeof data.brakeOn === 'boolean') setters.setBrakeLights(data.brakeOn);
  if (typeof data.headOn === 'boolean') setters.setHeadLights(data.headOn);
  if (typeof data.speed === 'number' && !Number.isNaN(data.speed)) {
    setters.setSpeed(data.speed);
  }
}

const BRAKE_MESH = 'LCT300095_Brakelights_UCB_Lights_and_Glass_0';
const HEADLIGHT_MESH = 'LCT300095_Headlights_UCB_Lights_and_Glass_0';
const WHEEL_RE = /^LCT300095_WheelStock_(FL|FR|RL|RR)$/;

/** rad/s per unit speed — tune so wheel motion matches your speed semantics */
const SPEED_TO_RAD_PER_SEC = 0.85;

/** |speed| above this starts to add suspension / rumble (slider is roughly -30…30) */
const SPEED_EFFECT_START = 8;

function effectIntensity(speed) {
  const v = Math.abs(speed);
  if (v <= SPEED_EFFECT_START) return 0;
  return Math.min(1, (v - SPEED_EFFECT_START) / 22);
}

function cloneMeshMaterial(material) {
  if (!material) return material;
  return Array.isArray(material) ? material.map((m) => m.clone()) : material.clone();
}

function forEachMaterial(material, fn) {
  if (!material) return;
  const list = Array.isArray(material) ? material : [material];
  for (const m of list) fn(m);
}

function Model({ url, brakeLights, headLights, speed, onHeadlightMesh }) {
  const { scene } = useGLTF(url);
  const rootRef = useRef(null);
  const baseYRef = useRef(0);
  const wheelsRef = useRef([]);
  const brakeMatRef = useRef(null);
  const headMatRef = useRef(null);

  useLayoutEffect(() => {
    scene.updateWorldMatrix(true, true);
    const box = new Box3().setFromObject(scene);
    const c = new Vector3();
    box.getCenter(c);
    if (rootRef.current) {
      const y = -box.min.y;
      baseYRef.current = y;
      rootRef.current.position.set(-c.x, y, -c.z);
    }
  }, [scene]);

  useLayoutEffect(() => {
    wheelsRef.current = [];
    scene.traverse((obj) => {
      if (WHEEL_RE.test(obj.name)) {
        wheelsRef.current.push(obj);
      }
      if (!obj.isMesh) return;
      obj.castShadow = true;
      obj.receiveShadow = true;
      if (obj.name === BRAKE_MESH && !obj.userData._vizBrakeMatCloned) {
        obj.material = cloneMeshMaterial(obj.material);
        obj.userData._vizBrakeMatCloned = true;
        brakeMatRef.current = obj.material;
      }
      if (obj.name === HEADLIGHT_MESH && !obj.userData._vizHeadMatCloned) {
        obj.material = cloneMeshMaterial(obj.material);
        obj.userData._vizHeadMatCloned = true;
        headMatRef.current = obj.material;
        onHeadlightMesh?.(obj);
      }
    });
  }, [scene, onHeadlightMesh]);

  useLayoutEffect(() => {
    const mat = brakeMatRef.current;
    if (!mat) return;
    forEachMaterial(mat, (m) => {
      if (!m.emissive) return;
      if (brakeLights) {
        m.emissive.setHex(0xff2a12);
        m.emissiveIntensity = 5.2;
      } else {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }
    });
  }, [brakeLights]);

  useLayoutEffect(() => {
    const mat = headMatRef.current;
    if (!mat) return;
    forEachMaterial(mat, (m) => {
      if (!m.emissive) return;
      if (headLights) {
        m.emissive.setHex(0xfffff2);
        m.emissiveIntensity = 9;
      } else {
        m.emissive.setHex(0x000000);
        m.emissiveIntensity = 0;
      }
    });
  }, [headLights]);

  useFrame((state, delta) => {
    const ω = speed * SPEED_TO_RAD_PER_SEC;
    if (ω) {
      for (const wheel of wheelsRef.current) {
        wheel.rotation.y += ω * delta;
      }
    }

    const root = rootRef.current;
    if (!root) return;
    const t = state.clock.elapsedTime;
    const v = Math.abs(speed);
    const susp = effectIntensity(speed);
    const bounce =
      susp > 0
        ? Math.sin(t * (11 + v * 0.15)) * (0.012 + susp * 0.028)
        : 0;
    root.position.y = baseYRef.current + bounce;
  });

  return (
    <group ref={rootRef}>
      <primitive object={scene} />
    </group>
  );
}

useGLTF.preload(TRUCK_GLB);

const SPEED_POST_DEBOUNCE_MS = 70;

const MAX_EVENT_LOG = 36;

const LINK_POLL_MS = 5000;

const SCENE_BG = '#05070a';

function formatLogTs() {
  const d = new Date();
  const p = (n, w = 2) => String(n).padStart(w, '0');
  return `${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}.${p(d.getMilliseconds(), 3)}`;
}

function EventLog({ entries, linkOk }) {
  const scrollRef = useRef(null);
  const stickBottomRef = useRef(true);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (!el || !stickBottomRef.current) return;
    el.scrollTop = el.scrollHeight;
  }, [entries]);

  function onScroll() {
    const el = scrollRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    stickBottomRef.current = gap < 10;
  }

  const linkShort = linkOk === true ? 'OK' : linkOk === false ? 'DN' : '…';
  const dotClass =
    linkOk === true
      ? 'hud-log-link-dot hud-log-link-dot--ok'
      : linkOk === false
        ? 'hud-log-link-dot hud-log-link-dot--bad'
        : 'hud-log-link-dot';

  return (
    <aside className="hud-log" aria-label="Event log">
      <div className="hud-log-panel">
        <div className="hud-log-head">
          <span className="hud-log-title">Event log</span>
          <span className="hud-log-link" title="Backend">
            <span className={dotClass} aria-hidden />
            <span>SRV {linkShort}</span>
          </span>
        </div>
        <div
          ref={scrollRef}
          className="hud-log-scroll"
          onScroll={onScroll}
          role="log"
          aria-live="polite"
          aria-relevant="additions"
        >
          {entries.map((e, i) => (
            <div key={`${e.ts}-${i}-${e.tag}`} className="hud-log-line">
              <span className="hud-log-ts">{e.ts}</span>
              <span className="msg">
                <span className="hud-log-tag">{e.tag}</span>
                {e.msg}
              </span>
            </div>
          ))}
        </div>
      </div>
    </aside>
  );
}

/** Subtle world-space jitter so the view feels like road/camera vibration at speed */
function SpeedRumble({ speed, children }) {
  const groupRef = useRef(null);

  useFrame((state) => {
    const g = groupRef.current;
    if (!g) return;
    const s = effectIntensity(speed);
    if (s <= 0) {
      g.position.set(0, 0, 0);
      g.rotation.set(0, 0, 0);
      return;
    }
    const t = state.clock.elapsedTime;
    const v = Math.abs(speed);
    const posAmp = 0.004 + s * 0.014;
    const rotAmp = 0.0008 + s * 0.0022;
    g.position.set(
      Math.sin(t * (18 + v * 0.08)) * posAmp,
      Math.sin(t * (14 + v * 0.06) + 1.1) * posAmp * 0.55,
      Math.cos(t * (16 + v * 0.07) + 0.4) * posAmp * 0.45,
    );
    g.rotation.set(
      Math.sin(t * (21 + v * 0.05)) * rotAmp,
      Math.cos(t * (17 + v * 0.04)) * rotAmp * 0.7,
      Math.sin(t * (19 + v * 0.06) + 0.8) * rotAmp * 0.6,
    );
  });

  return <group ref={groupRef}>{children}</group>;
}

/**
 * Truck GLB is lengthwise along ±X (bbox centered at origin). Anchor just past the cab on +X;
 * group yaw maps local +Z (cone / fan forward) onto world +X. If the overlay is behind the truck,
 * flip to [-2.05, 0.85, 0] and rotation [0, -Math.PI / 2, 0].
 */
const FAKE_PERCEPTION_ANCHOR = [2.85, 0.85, 0];
/** Euler [rx, ry, rz] applied before children so “forward” matches the truck. */
const FAKE_PERCEPTION_GROUP_ROT = [0, Math.PI / 2, 0];
/** Parent-local +Z: shifts cone apex forward; lidar fan stays anchored at FAKE_PERCEPTION_ANCHOR. */
const FAKE_PERCEPTION_CONE_FORWARD = 4.0;

function FakePerceptionOverlay({ enabled }) {
  const sweepRef = useRef(null);

  const lidarGeom = useMemo(() => {
    const positions = [];
    const rays = 36;
    const reach = 11;
    const halfSpread = Math.PI / 2.15;
    for (let i = 0; i < rays; i++) {
      const a = -halfSpread + (i / (rays - 1 || 1)) * halfSpread * 2;
      positions.push(0, 0, 0, Math.sin(a) * reach, 0, Math.cos(a) * reach);
    }
    for (const dist of [3.8, 7.2, 10.2]) {
      const segs = 28;
      for (let i = 0; i < segs; i++) {
        const a0 = -halfSpread + (i / segs) * 2 * halfSpread;
        const a1 = -halfSpread + ((i + 1) / segs) * 2 * halfSpread;
        positions.push(
          Math.sin(a0) * dist,
          0,
          Math.cos(a0) * dist,
          Math.sin(a1) * dist,
          0,
          Math.cos(a1) * dist,
        );
      }
    }
    const g = new BufferGeometry();
    g.setAttribute('position', new Float32BufferAttribute(new Float32Array(positions), 3));
    return g;
  }, []);

  useFrame((state) => {
    const g = sweepRef.current;
    if (!g || !enabled) return;
    g.rotation.y = Math.sin(state.clock.elapsedTime * 0.9) * 0.11;
  });

  if (!enabled) return null;

  return (
    <group position={FAKE_PERCEPTION_ANCHOR} rotation={FAKE_PERCEPTION_GROUP_ROT}>
      <group position={[0, 0, FAKE_PERCEPTION_CONE_FORWARD]}>
        {/* Apex toward -local Z, opening +local Z; with group yaw, opens along world +X */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <coneGeometry args={[3, 8, 32, 1, true]} />
          <meshBasicMaterial
            color="#2ee8d0"
            transparent
            opacity={0.11}
            depthWrite={false}
            side={DoubleSide}
          />
        </mesh>
      </group>
      <group ref={sweepRef}>
        <lineSegments geometry={lidarGeom}>
          <lineBasicMaterial color="#5ee0ff" transparent opacity={0.5} depthWrite={false} />
        </lineSegments>
      </group>
    </group>
  );
}

function Ground() {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial
          color="#0a0c10"
          roughness={0.92}
          metalness={0.06}
          envMapIntensity={0.35}
        />
      </mesh>
      <Grid
        position={[0, 0.002, 0]}
        args={[200, 200]}
        infiniteGrid
        fadeDistance={55}
        fadeStrength={1.15}
        fadeFrom={0.85}
        cellSize={0.45}
        sectionSize={4.5}
        cellThickness={0.6}
        sectionThickness={0.9}
        cellColor="#1e2838"
        sectionColor="#2a3548"
        side={2}
      />
    </group>
  );
}

export default function App() {
  const [brakeLights, setBrakeLights] = useState(false);
  const [headLights, setHeadLights] = useState(false);
  const [speed, setSpeed] = useState(0);
  const [headBloomMesh, setHeadBloomMesh] = useState(null);
  const [perceptionDev, setPerceptionDev] = useState(false);
  const [eventLog, setEventLog] = useState([]);
  const [linkOk, setLinkOk] = useState(null);

  const speedDebounceRef = useRef(null);
  const latestSpeedRef = useRef(0);
  const ambientRef = useRef(null);
  const sunRef = useRef(null);
  const linkPrevRef = useRef(null);

  const pushLog = useCallback((tag, msg = '') => {
    setEventLog((prev) => [...prev, { ts: formatLogTs(), tag, msg }].slice(-MAX_EVENT_LOG));
  }, []);

  useEffect(() => {
    let cancelled = false;
    api
      .getState()
      .then((data) => {
        if (cancelled) return;
        setLinkOk(true);
        applySnapshot({ setBrakeLights, setHeadLights, setSpeed }, data);
        latestSpeedRef.current = data.speed ?? 0;
        pushLog('ST', 'SYNC');
      })
      .catch((err) => {
        console.warn('Failed to load /state', err);
        if (!cancelled) setLinkOk(false);
      });
    return () => {
      cancelled = true;
    };
  }, [pushLog]);

  useEffect(() => {
    const id = window.setInterval(() => {
      api
        .getState()
        .then(() => setLinkOk(true))
        .catch(() => setLinkOk(false));
    }, LINK_POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (linkOk === null) return;
    const prev = linkPrevRef.current;
    if (prev === null) {
      linkPrevRef.current = linkOk;
      return;
    }
    if (prev === true && linkOk === false) pushLog('LNK', 'DN');
    if (prev === false && linkOk === true) pushLog('LNK', 'UP');
    linkPrevRef.current = linkOk;
  }, [linkOk, pushLog]);

  useEffect(() => {
    return () => {
      if (speedDebounceRef.current) clearTimeout(speedDebounceRef.current);
    };
  }, []);

  async function handleBrakeChange(on) {
    try {
      const data = await api.postBrake(on);
      setLinkOk(true);
      applySnapshot({ setBrakeLights, setHeadLights, setSpeed }, data);
      latestSpeedRef.current = data.speed ?? 0;
      pushLog('BRK', on ? 'ON' : 'OFF');
    } catch (err) {
      console.warn(err);
    }
  }

  async function handleHeadChange(on) {
    try {
      const data = await api.postHead(on);
      setLinkOk(true);
      applySnapshot({ setBrakeLights, setHeadLights, setSpeed }, data);
      latestSpeedRef.current = data.speed ?? 0;
      pushLog('HD', on ? 'ON' : 'OFF');
    } catch (err) {
      console.warn(err);
    }
  }

  function handleSpeedChange(value) {
    setSpeed(value);
    latestSpeedRef.current = value;
    if (speedDebounceRef.current) clearTimeout(speedDebounceRef.current);
    speedDebounceRef.current = setTimeout(async () => {
      speedDebounceRef.current = null;
      const v = latestSpeedRef.current;
      try {
        const data = await api.postSpeed(v);
        setLinkOk(true);
        applySnapshot({ setBrakeLights, setHeadLights, setSpeed }, data);
        latestSpeedRef.current = data.speed ?? v;
        pushLog('SPD', String(v));
      } catch (err) {
        console.warn(err);
      }
    }, SPEED_POST_DEBOUNCE_MS);
  }

  return (
    <>
      <aside className="hud" aria-label="Vehicle controls">
        <div className="hud-panel">
          <header className="hud-header">
            <p className="hud-kicker">Interface</p>
            <h1 className="hud-title">Vehicle control</h1>
          </header>

          <div className="hud-section">
            <p className="hud-section-label">Lighting</p>
            <label className="hud-toggle">
              <span className="hud-toggle-text">Brake / tail</span>
              <input
                className="hud-toggle-input"
                type="checkbox"
                checked={brakeLights}
                onChange={(e) => handleBrakeChange(e.target.checked)}
              />
              <span className="hud-toggle-track" aria-hidden>
                <span className="hud-toggle-thumb" />
              </span>
            </label>
            <label className="hud-toggle">
              <span className="hud-toggle-text">Headlights</span>
              <input
                className="hud-toggle-input"
                type="checkbox"
                checked={headLights}
                onChange={(e) => handleHeadChange(e.target.checked)}
              />
              <span className="hud-toggle-track" aria-hidden>
                <span className="hud-toggle-thumb" />
              </span>
            </label>
          </div>

          <div className="hud-section">
            <p className="hud-section-label">Visualization</p>
            <label className="hud-toggle">
              <span className="hud-toggle-text">Toy perception (cone + lidar lines)</span>
              <input
                className="hud-toggle-input"
                type="checkbox"
                checked={perceptionDev}
                onChange={(e) => setPerceptionDev(e.target.checked)}
              />
              <span className="hud-toggle-track" aria-hidden>
                <span className="hud-toggle-thumb" />
              </span>
            </label>
          </div>

          <div className="hud-section">
            <p className="hud-section-label">Propulsion</p>
            <div className="hud-speed-head">
              <span className="hud-speed-label">Speed</span>
              <span className="hud-speed-value">{speed}</span>
            </div>
            <input
              className="hud-range"
              type="range"
              min={-30}
              max={30}
              step={0.5}
              value={speed}
              onChange={(e) => handleSpeedChange(Number(e.target.value))}
              aria-valuemin={-30}
              aria-valuemax={30}
              aria-valuenow={speed}
            />
          </div>
        </div>
      </aside>
      <EventLog entries={eventLog} linkOk={linkOk} />
      {/* R3F only mounts the WebGL scene when useMeasure sees width/height both > 0.
          Viewport units avoid a 0×0 container when % heights don’t resolve. */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          width: '100vw',
          height: '100vh',
          zIndex: 0,
        }}
      >
        <Canvas
          shadows="soft"
          camera={{ position: [3.2, 2.2, 3.2], fov: 45 }}
          gl={{ antialias: true }}
          style={{ width: '100%', height: '100%', display: 'block' }}
        >
          <color attach="background" args={[SCENE_BG]} />
          <fog attach="fog" args={[SCENE_BG, 6, 38]} />
          <ambientLight ref={ambientRef} intensity={0.22} />
          <directionalLight
            ref={sunRef}
            castShadow
            position={[7, 11, 5]}
            intensity={0.95}
            shadow-mapSize={[2048, 2048]}
            shadow-camera-near={0.5}
            shadow-camera-far={80}
            shadow-camera-left={-14}
            shadow-camera-right={14}
            shadow-camera-top={14}
            shadow-camera-bottom={-14}
            shadow-bias={-0.00025}
            shadow-normalBias={0.02}
          />
          <Suspense fallback={null}>
            <Environment preset="warehouse" background={false} environmentIntensity={1} />
            <SpeedRumble speed={speed}>
              <Ground />
              <Model
                url={TRUCK_GLB}
                brakeLights={brakeLights}
                headLights={headLights}
                speed={speed}
                onHeadlightMesh={setHeadBloomMesh}
              />
              <FakePerceptionOverlay enabled={perceptionDev} />
            </SpeedRumble>
          </Suspense>
          <EffectComposer multisampling={4}>
            {headBloomMesh ? (
              <SelectiveBloom
                lights={[sunRef, ambientRef]}
                selection={headBloomMesh}
                intensity={1.25}
                luminanceThreshold={0}
                luminanceSmoothing={0.32}
                mipmapBlur
              />
            ) : null}
          </EffectComposer>
          <OrbitControls makeDefault enableDamping dampingFactor={0.05} minDistance={1.2} maxDistance={22} />
        </Canvas>
      </div>
    </>
  );
}
