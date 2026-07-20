import React, { useState, useEffect, useRef } from 'react';
import {
  Gauge, ChevronsDown, Wind, Timer, Activity, Layers, Power, Radio,
  ScanLine, MoveHorizontal, Thermometer, Zap, Crosshair, CircleDot
} from 'lucide-react';

/* ---------------------------------- DATA ---------------------------------- */
const PARTS = {
  front: {
    id: 'front',
    label: 'Front Wing',
    sub: 'Downforce Generator',
    color: '#22d3ee',
    rgb: '34,211,238',
    icon: Wind,
    desc: 'Multi-element sculpted wing that conditions all downstream airflow. First contact point with the air — generates ~32% of total downforce and shapes the Y250 vortex.',
    share: 0.32,
    hotspot: { left: '11%', top: '78%' },
    stats: [['Element Count', '4 + Endplates'], ['Y250 Vortex', 'Stable'], ['Pitch Sensitivity', 'High']],
  },
  sidepods: {
    id: 'sidepods',
    label: 'Sidepods',
    sub: 'Cooling / Venturi Tunnels',
    color: '#60a5fa',
    rgb: '96,165,250',
    icon: Thermometer,
    desc: 'Deep-undercut inlets feed the radiators while the underfloor Venturi tunnels accelerate air to generate ground-effect suction — the largest single downforce source.',
    share: 0.40,
    hotspot: { left: '57%', top: '71%' },
    stats: [['Inlet Type', 'Deep Undercut'], ['Radiator ΔT', '+2.1 °C'], ['Venturi Peak', '1.8 g Suction']],
  },
  rear: {
    id: 'rear',
    label: 'Rear Wing & DRS',
    sub: 'Drag Reduction System',
    color: '#f87171',
    rgb: '248,113,113',
    icon: Zap,
    desc: 'High-downforce mainplane with a hydraulically actuated flap. Opening DRS flattens the flap, slashing drag by ~30% for overtaking at the cost of rear stability.',
    share: 0.28,
    hotspot: { left: '88%', top: '38%' },
    stats: [['Mainplane', 'High-DF Spec'], ['DRS Delta', '−30% Drag'], ['Beam Wing', 'Active']],
  },
};

/* --------------------------------- SWITCH --------------------------------- */
const Switch = ({ on, onClick, color = '#22d3ee' }) => (
  <button
    onClick={onClick}
    className="relative h-5 w-9 shrink-0 rounded-full border border-white/15 transition-colors duration-300"
    style={{ background: on ? `${color}2e` : 'rgba(255,255,255,0.05)' }}
  >
    <span
      className="absolute top-1/2 h-3.5 w-3.5 -translate-y-1/2 rounded-full transition-all duration-300"
      style={{
        left: on ? 'calc(100% - 17px)' : '3px',
        background: on ? color : '#475569',
        boxShadow: on ? `0 0 10px ${color}` : 'none',
      }}
    />
  </button>
);

/* --------------------------------- MAIN ----------------------------------- */
export default function Formula1AeroShowroom() {
  const [activePart, setActivePart] = useState('front');
  const [velocity, setVelocity] = useState(220);
  const [drsOpen, setDrsOpen] = useState(false);
  const [showAirflow, setShowAirflow] = useState(true);
  const [showGrid, setShowGrid] = useState(true);
  const [elapsed, setElapsed] = useState(0);

  const canvasRef = useRef(null);
  const partRef = useRef(activePart);
  const velRef = useRef(velocity);
  const drsRef = useRef(drsOpen);
  /* --------------------------- REFS & SESSION CLOCK --------------------------- */
  useEffect(() => { partRef.current = activePart; }, [activePart]);
  useEffect(() => { velRef.current = velocity; }, [velocity]);
  useEffect(() => { drsRef.current = drsOpen; }, [drsOpen]);

  const airflowRef = useRef(showAirflow);
  const gridRef = useRef(showGrid);
  useEffect(() => { airflowRef.current = showAirflow; }, [showAirflow]);
  useEffect(() => { gridRef.current = showGrid; }, [showGrid]);

  useEffect(() => {
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, []);
  const mm = String(Math.floor(elapsed / 60)).padStart(2, '0');
  const ss = String(elapsed % 60).padStart(2, '0');

  /* --------------------------- AIRFLOW CANVAS ENGINE --------------------------- */
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf, w = 0, h = 0;

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    window.addEventListener('resize', resize);

    // Particle stream
    const COUNT = 150;
    const P = Array.from({ length: COUNT }, () => ({
      x: Math.random() * 1600,
      baseY: Math.random(),
      speed: 1 + Math.random() * 1.6,
      len: 18 + Math.random() * 26,
      a: 0.22 + Math.random() * 0.5,
    }));

    const gauss = (x, c, s) => Math.exp(-((x - c) * (x - c)) / (2 * s * s));

    // Streamline deflection field (normalized coords), tuned to the SVG car below
    const flowOffset = (nx, ny, part, drs) => {
      let o = 0;
      if (part === 'front') {
        // Airflow curves sharply downward under the nose (nose at nx ≈ 0.17)
        if (ny > 0.55) o += gauss(nx, 0.17, 0.09) * 0.24 * (ny - 0.35);
        else o -= gauss(nx, 0.15, 0.07) * 0.05 * (0.62 - ny);
      } else if (part === 'sidepods') {
        // Streamlines split & hug the sidepod contour (nx ≈ 0.47–0.68)
        const amp = gauss(nx, 0.56, 0.12) * 0.20;
        o += ny >= 0.52 ? amp * (ny - 0.30) : -amp * (0.74 - ny);
      } else {
        // Sweep up & over the rear wing; DRS flattens the angle
        const amp = drs ? 0.05 : 0.17;
        o -= gauss(nx, 0.87, 0.09) * amp * (1.15 - ny);
        if (!drs) o += gauss(nx, 0.79, 0.06) * 0.07 * Math.max(0, ny - 0.5); // diffuser kick
      }
      return o;
    };

    const colors = { front: '34,211,238', sidepods: '96,165,250', rear: '248,113,113' };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);

      // HUD grid
      if (gridRef.current) {
        ctx.strokeStyle = 'rgba(148,163,184,0.07)';
        ctx.lineWidth = 1;
        for (let gx = 0; gx <= w; gx += w / 12) {
          ctx.beginPath(); ctx.moveTo(gx, 0); ctx.lineTo(gx, h); ctx.stroke();
        }
        for (let gy = 0; gy <= h; gy += h / 8) {
          ctx.beginPath(); ctx.moveTo(0, gy); ctx.lineTo(w, gy); ctx.stroke();
        }
      }

      if (airflowRef.current) {
        const part = partRef.current;
        const drs = drsRef.current;
        const vf = 0.4 + (velRef.current / 350) * 3.4; // velocity drives particle speed
        const col = colors[part];
        ctx.lineWidth = 1.2;

        for (const p of P) {
          p.x += p.speed * vf;
          if (p.x > w + 40) { p.x = -40; p.baseY = Math.random(); }

          const y1 = p.baseY * h + flowOffset(p.x / w, p.baseY, part, drs) * h;
          const x2 = p.x - p.len * (0.6 + vf * 0.28);
          const y2 = p.baseY * h + flowOffset(x2 / w, p.baseY, part, drs) * h;

          const grad = ctx.createLinearGradient(x2, y2, p.x, y1);
          grad.addColorStop(0, `rgba(${col},0)`);
          grad.addColorStop(1, `rgba(${col},${p.a})`);
          ctx.strokeStyle = grad;
          ctx.beginPath(); ctx.moveTo(x2, y2); ctx.lineTo(p.x, y1); ctx.stroke();
        }
      }
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', resize); };
  }, []);

  /* ------------------------------ TELEMETRY MATH ------------------------------ */
  const part = PARTS[activePart];
  const vFactor = Math.pow(velocity / 100, 2);
  const totalDownforce = Math.round(1450 * vFactor);
  const partDownforce = Math.round(totalDownforce * part.share);
  const dragForce = Math.round(430 * vFactor * (drsOpen ? 0.7 : 1));
  const cdValue = drsOpen ? 0.648 : 0.925;
  const topSpeed = Math.round(336 + velocity * 0.03 + (drsOpen ? 22 : 0));
  const balanceMap = { front: 46.2, sidepods: 41.0, rear: 36.8 };
  const balFront = Math.min(50, balanceMap[activePart] + (velocity / 350) * 1.2);
  const balRear = 100 - balFront;

  /* --------------------------------- HELPERS --------------------------------- */
  const panel = 'rounded-xl border border-white/10 bg-white/5 backdrop-blur-md';
  const strokeFor = (id) => (activePart === id ? PARTS[id].color : 'rgba(148,163,184,0.45)');
  const glowFor = (id) =>
    activePart === id ? { filter: `drop-shadow(0 0 7px ${PARTS[id].color})` } : {};

  return (
    <div className="min-h-screen bg-neutral-950 font-sans text-slate-200 selection:bg-cyan-500/30">
      <style>{`
        .bg-grid-hud {
          background-image:
            linear-gradient(rgba(148,163,184,0.045) 1px, transparent 1px),
            linear-gradient(90deg, rgba(148,163,184,0.045) 1px, transparent 1px);
          background-size: 44px 44px;
        }
        @keyframes dashmove { to { stroke-dashoffset: -48; } }
        .flow-dash { animation: dashmove 1.4s linear infinite; }
        input[type='range'].hud-range {
          -webkit-appearance: none; appearance: none;
          height: 4px; border-radius: 9999px; outline: none; cursor: pointer;
        }
        input[type='range'].hud-range::-webkit-slider-thumb {
          -webkit-appearance: none; width: 16px; height: 16px; border-radius: 9999px;
          background: #22d3ee; border: 2px solid #0e7490;
          box-shadow: 0 0 12px rgba(34,211,238,0.9); cursor: pointer;
        }
        input[type='range'].hud-range::-moz-range-thumb {
          width: 16px; height: 16px; border-radius: 9999px;
          background: #22d3ee; border: 2px solid #0e7490;
          box-shadow: 0 0 12px rgba(34,211,238,0.9); cursor: pointer;
        }
      `}</style>

      {/* Backdrop glow */}
      <div className="pointer-events-none fixed inset-0 bg-grid-hud" />
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_top,rgba(34,211,238,0.07),transparent_55%),radial-gradient(ellipse_at_bottom_right,rgba(239,68,68,0.06),transparent_50%)]" />

      <div className="relative mx-auto max-w-[1600px]">
        {/* --------------------------------- HEADER --------------------------------- */}
        <header className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 lg:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-red-500/40 bg-red-500/10 shadow-[0_0_15px_rgba(239,68,68,0.35)]">
              <Zap className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <h1 className="text-sm font-bold tracking-[0.22em] text-white sm:text-base">
                FORMULA 1 <span className="text-cyan-400 drop-shadow-[0_0_8px_rgba(34,211,238,0.7)]">AERO &amp; SPEC</span> SHOWROOM
              </h1>
              <p className="font-mono text-[10px] tracking-[0.3em] text-slate-500">WIND TUNNEL // VIRTUAL PIT WALL</p>
            </div>
          </div>
          <div className="hidden items-center gap-2 lg:flex">
            {['AERO MAP', 'TELEMETRY', 'DRS SYSTEM'].map((t) => (
              <span key={t} className="rounded-md border border-white/10 bg-white/5 px-3 py-1 font-mono text-[10px] tracking-widest text-slate-400">{t}</span>
            ))}
          </div>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-3 py-1.5 font-mono text-[10px] tracking-widest text-red-300">
              <Radio className="h-3.5 w-3.5 animate-pulse" /> LIVE
            </span>
            <span className="hidden items-center gap-2 rounded-md border border-white/10 bg-white/5 px-3 py-1.5 font-mono text-[10px] tracking-widest text-cyan-300 sm:flex">
              <Timer className="h-3.5 w-3.5" /> {mm}:{ss}
            </span>
          </div>
        </header>

        {/* ------------------------------ MAIN DASHBOARD ------------------------------ */}
        <main className="grid grid-cols-1 gap-4 p-4 lg:grid-cols-[290px_minmax(0,1fr)_310px] lg:p-6">

          {/* ============================ LEFT: TELEMETRY ============================ */}
          <section className="order-2 flex flex-col gap-4 lg:order-1">
            {/* Velocity readout */}
            <div className={`${panel} p-4 shadow-[0_0_15px_rgba(59,130,246,0.15)]`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-slate-500">
                  <Activity className="h-3.5 w-3.5 text-cyan-400" /> LIVE TELEMETRY
                </span>
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-cyan-400 shadow-[0_0_8px_#22d3ee]" />
              </div>
              <div className="mt-3 flex items-end gap-2">
                <span className="font-mono text-5xl font-bold leading-none text-cyan-300 drop-shadow-[0_0_12px_rgba(34,211,238,0.6)]">
                  {velocity}
                </span>
                <span className="pb-1 font-mono text-xs tracking-widest text-slate-500">KM/H</span>
              </div>
              <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-500 via-cyan-400 to-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.7)] transition-all duration-300"
                  style={{ width: `${(velocity / 350) * 100}%` }}
                />
              </div>
              <div className="mt-1 flex justify-between font-mono text-[9px] text-slate-600">
                <span>0</span><span>WIND SPEED</span><span>350</span>
              </div>
            </div>

            {/* Stat tiles */}
            <div className="grid grid-cols-2 gap-2">
              {[
                { icon: ChevronsDown, label: 'DOWNFORCE', value: `${totalDownforce.toLocaleString()}`, unit: 'N', color: 'text-cyan-300' },
                { icon: Wind, label: 'DRAG FORCE', value: `${dragForce.toLocaleString()}`, unit: 'N', color: drsOpen ? 'text-red-300' : 'text-slate-200' },
                { icon: MoveHorizontal, label: 'DRAG COEFF', value: cdValue.toFixed(3), unit: 'Cd', color: drsOpen ? 'text-red-300' : 'text-slate-200' },
                { icon: Timer, label: 'EST. TOP SPD', value: `${topSpeed}`, unit: 'KM/H', color: 'text-blue-300' },
              ].map((t) => (
                <div key={t.label} className={`${panel} p-3`}>
                  <div className="flex items-center gap-1.5 font-mono text-[9px] tracking-widest text-slate-500">
                    <t.icon className="h-3 w-3 text-slate-400" /> {t.label}
                  </div>
                  <div className={`mt-1.5 font-mono text-lg font-semibold ${t.color}`}>
                    {t.value} <span className="text-[10px] font-normal text-slate-500">{t.unit}</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Aero balance */}
            <div className={`${panel} p-4`}>
              <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-slate-500">
                <Layers className="h-3.5 w-3.5 text-blue-400" /> AERO BALANCE
              </div>
              <div className="mt-3 flex h-2.5 w-full overflow-hidden rounded-full border border-white/10">
                <div
                  className="h-full bg-gradient-to-r from-cyan-500 to-blue-400 shadow-[0_0_10px_rgba(34,211,238,0.6)] transition-all duration-500"
                  style={{ width: `${balFront}%` }}
                />
                <div className="h-full flex-1 bg-gradient-to-r from-red-500/80 to-red-400/60 transition-all duration-500" />
              </div>
              <div className="mt-2 flex justify-between font-mono text-[10px]">
                <span className="text-cyan-300">F {balFront.toFixed(1)}%</span>
                <span className="text-slate-600">FRONT / REAR</span>
                <span className="text-red-300">R {balRear.toFixed(1)}%</span>
              </div>
            </div>

            {/* Active aero data */}
            <div
              className={`${panel} p-4 transition-all duration-300`}
              style={{ borderColor: `${part.color}55`, boxShadow: `0 0 20px ${part.color}22` }}
            >
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 items-center justify-center rounded-lg border"
                  style={{ borderColor: `${part.color}66`, background: `${part.color}14`, boxShadow: `0 0 12px ${part.color}44` }}
                >
                  <part.icon className="h-4.5 w-4.5 h-5 w-5" style={{ color: part.color }} />
                </div>
                <div>
                  <div className="text-sm font-bold tracking-wider text-white">{part.label}</div>
                  <div className="font-mono text-[9px] tracking-[0.2em]" style={{ color: part.color }}>{part.sub.toUpperCase()}</div>
                </div>
              </div>
              <p className="mt-3 text-[11px] leading-relaxed text-slate-400">{part.desc}</p>
              <div className="mt-3 flex items-center justify-between rounded-md border border-white/10 bg-black/30 px-3 py-2">
                <span className="font-mono text-[9px] tracking-widest text-slate-500">CONTRIBUTION</span>
                <span className="font-mono text-sm font-bold" style={{ color: part.color, textShadow: `0 0 10px ${part.color}88` }}>
                  {partDownforce.toLocaleString()} N <span className="text-[10px] text-slate-500">({Math.round(part.share * 100)}%)</span>
                </span>
              </div>
              <div className="mt-3 space-y-1.5">
                {part.stats.map(([k, v]) => (
                  <div key={k} className="flex items-center justify-between font-mono text-[10px]">
                    <span className="tracking-widest text-slate-500">{k.toUpperCase()}</span>
                    <span className="text-slate-300">{v}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          {/* ============================ CENTER: CAR ============================ */}
          <section className={`${panel} relative order-1 min-h-[440px] overflow-hidden shadow-[0_0_40px_rgba(34,211,238,0.08)] lg:order-2 lg:min-h-[600px]`}>
            {/* Canvas airflow (behind wireframe) */}
            <canvas ref={canvasRef} className="absolute inset-0 z-0 h-full w-full" />

            {/* HUD corner brackets */}
            {['top-2 left-2 border-t-2 border-l-2', 'top-2 right-2 border-t-2 border-r-2', 'bottom-2 left-2 border-b-2 border-l-2', 'bottom-2 right-2 border-b-2 border-r-2'].map((c) => (
              <div key={c} className={`pointer-events-none absolute z-30 h-5 w-5 border-cyan-400/50 ${c}`} />
            ))}

            {/* Top overlay bar */}
            <div className="pointer-events-none absolute inset-x-0 top-0 z-30 flex items-center justify-between px-5 py-3">
              <span className="font-mono text-[10px] tracking-[0.3em] text-slate-500">AERO MAP // SIDE PROFILE</span>
              <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em]" style={{ color: part.color }}>
                <Crosshair className="h-3.5 w-3.5" /> TARGET: {part.label.toUpperCase()}
              </span>
            </div>

            {/* Bottom overlay readout */}
            <div className="pointer-events-none absolute inset-x-0 bottom-0 z-30 flex items-center justify-between px-5 py-3 font-mono text-[9px] tracking-[0.2em] text-slate-600">
              <span>FLOW: <span className="text-cyan-500">LAMINAR</span></span>
              <span>Re {(velocity * 3.2).toFixed(1)} × 10⁵</span>
              <span>DRS: <span className={drsOpen ? 'text-red-400' : 'text-slate-500'}>{drsOpen ? 'OPEN' : 'CLOSED'}</span></span>
            </div>

            {/* ------------------------------ F1 CAR SVG ------------------------------ */}
            <svg viewBox="0 0 900 320" preserveAspectRatio="xMidYMid meet" className="absolute inset-0 z-10 h-full w-full">
              {/* Ground line */}
              <line x1="20" y1="290" x2="880" y2="290" stroke="rgba(148,163,184,0.25)" strokeWidth="1" strokeDasharray="8 6" />

              {/* ===== NEUTRAL CHASSIS ===== */}
              <g fill="none" stroke="rgba(226,232,240,0.55)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round">
                {/* Wheels */}
                <circle cx="215" cy="248" r="40" />
                <circle cx="215" cy="248" r="22" strokeDasharray="4 4" opacity="0.5" />
                <circle cx="215" cy="248" r="5" />
                <circle cx="695" cy="248" r="42" />
                <circle cx="695" cy="248" r="23" strokeDasharray="4 4" opacity="0.5" />
                <circle cx="695" cy="248" r="5" />
                {/* Nose cone */}
                <path d="M150,258 L340,196" />
                <path d="M162,266 L345,212" />
                {/* Monocoque / cockpit */}
                <path d="M340,196 L470,186 L560,208 L575,238 L360,238 L345,212 Z" />
                <path d="M398,196 Q430,180 466,192" opacity="0.7" />
                {/* Halo */}
                <path d="M385,200 Q425,156 470,196" strokeWidth="5" />
                <line x1="430" y1="176" x2="432" y2="196" strokeWidth="4" />
                {/* Engine cover / shark fin */}
                <path d="M470,186 L668,128 L688,206 L560,208 Z" />
                <ellipse cx="492" cy="176" rx="18" ry="10" />
                {/* Floor + diffuser */}
                <path d="M165,274 L640,274" />
                <path d="M640,274 L706,240" />
                <path d="M655,274 L700,248" opacity="0.6" />
                <path d="M670,274 L704,256" opacity="0.6" />
                {/* Suspension */}
                <path d="M330,220 L215,240" opacity="0.7" />
                <path d="M335,232 L218,256" opacity="0.7" />
                <path d="M600,225 L695,244" opacity="0.7" />
                <path d="M605,238 L692,258" opacity="0.7" />
                {/* Wing mirrors */}
                <path d="M368,192 L356,182" />
                <circle cx="354" cy="180" r="3" />
              </g>

              {/* ===== FRONT WING (hotspot 1) ===== */}
              <g
                fill="none"
                stroke={strokeFor('front')}
                strokeWidth={activePart === 'front' ? 2.6 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ ...glowFor('front'), transition: 'all .3s' }}
              >
                <polygon points="48,270 170,263 158,242 58,249" />
                <path d="M60,254 L156,247" />
                <path d="M64,260 L160,253" opacity="0.6" />
                <polygon points="36,238 54,236 58,274 38,274" />
                <path d="M100,246 L104,266" opacity="0.5" />
                <path d="M130,244 L134,264" opacity="0.5" />
                {activePart === 'front' && (
                  <path className="flow-dash" d="M20,232 Q90,236 150,252" strokeDasharray="6 6" opacity="0.8" />
                )}
              </g>

              {/* ===== SIDEPODS (hotspot 2) ===== */}
              <g
                fill="none"
                stroke={strokeFor('sidepods')}
                strokeWidth={activePart === 'sidepods' ? 2.6 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ ...glowFor('sidepods'), transition: 'all .3s' }}
              >
                <polygon points="425,216 560,206 614,224 606,256 438,258 422,236" />
                <polygon points="428,216 470,211 470,233 428,235" opacity="0.85" />
                <path d="M580,222 L576,250" opacity="0.6" />
                <path d="M590,224 L586,251" opacity="0.6" />
                <path d="M600,227 L596,252" opacity="0.6" />
                <path d="M440,264 L520,264" opacity="0.8" />
                <path d="M455,264 L450,272" opacity="0.5" />
                <path d="M495,264 L492,272" opacity="0.5" />
                {activePart === 'sidepods' && (
                  <path className="flow-dash" d="M380,240 Q500,200 620,240" strokeDasharray="6 6" opacity="0.8" />
                )}
              </g>

              {/* ===== REAR WING & DRS (hotspot 3) ===== */}
              <g
                fill="none"
                stroke={strokeFor('rear')}
                strokeWidth={activePart === 'rear' ? 2.6 : 2}
                strokeLinejoin="round"
                strokeLinecap="round"
                style={{ ...glowFor('rear'), transition: 'all .3s' }}
              >
                <polygon points="726,100 852,88 856,178 730,186" />
                <polygon points="740,150 846,142 848,156 742,164" />
                {/* DRS flap: rotates flat when open */}
                {drsOpen ? (
                  <polygon points="736,124 850,118 850,128 737,134" stroke="#f87171" style={{ filter: 'drop-shadow(0 0 8px #f87171)' }} />
                ) : (
                  <polygon points="736,112 848,102 850,118 738,128" />
                )}
                <rect x="786" y="108" width="10" height="8" opacity="0.8" />
                <polygon points="742,196 828,190 830,200 744,206" opacity="0.85" />
                <path d="M688,206 L740,160" opacity="0.6" />
                {drsOpen && (
                  <text x="742" y="76" fontFamily="monospace" fontSize="13" fill="#f87171" style={{ filter: 'drop-shadow(0 0 6px #f87171)' }}>
                    DRS OPEN
                  </text>
                )}
                {activePart === 'rear' && (
                  <path
                    className="flow-dash"
                    d={drsOpen ? 'M700,120 Q790,110 880,116' : 'M700,150 Q790,90 880,70'}
                    strokeDasharray="6 6"
                    opacity="0.8"
                  />
                )}
              </g>
            </svg>

            {/* ------------------------------ HOTSPOTS ------------------------------ */}
            {Object.values(PARTS).map((p) => {
              const isActive = activePart === p.id;
              return (
                <button
                  key={p.id}
                  onClick={() => setActivePart(p.id)}
                  className="absolute z-20 -translate-x-1/2 -translate-y-1/2 outline-none"
                  style={{ left: p.hotspot.left, top: p.hotspot.top }}
                  aria-label={p.label}
                >
                  <span className="relative flex h-7 w-7 items-center justify-center">
                    {isActive && (
                      <span
                        className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40"
                        style={{ background: p.color }}
                      />
                    )}
                    <span
                      className="absolute inline-flex h-6 w-6 rounded-full border-2 transition-all duration-300"
                      style={{
                        borderColor: isActive ? p.color : 'rgba(148,163,184,0.5)',
                        boxShadow: isActive ? `0 0 14px ${p.color}` : 'none',
                        background: isActive ? `${p.color}22` : 'rgba(0,0,0,0.4)',
                      }}
                    />
                    <span
                      className="relative inline-flex h-2 w-2 rounded-full"
                      style={{ background: isActive ? p.color : '#94a3b8', boxShadow: isActive ? `0 0 8px ${p.color}` : 'none' }}
                    />
                  </span>
                  <span
                    className="absolute left-1/2 top-full mt-1 -translate-x-1/2 whitespace-nowrap font-mono text-[8px] tracking-[0.2em] transition-colors"
                    style={{ color: isActive ? p.color : 'rgba(148,163,184,0.6)' }}
                  >
                    {p.label.toUpperCase()}
                  </span>
                </button>
              );
            })}

            {/* Scanline sweep */}
            <div className="pointer-events-none absolute inset-0 z-30 bg-[linear-gradient(transparent_0%,rgba(34,211,238,0.03)_50%,transparent_100%)] bg-[length:100%_200%]" />
          </section>

          {/* ============================ RIGHT: CONTROLS ============================ */}
          <section className="order-3 flex flex-col gap-4">
            {/* Wind tunnel slider */}
            <div className={`${panel} p-4 shadow-[0_0_15px_rgba(59,130,246,0.15)]`}>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-slate-500">
                  <Gauge className="h-3.5 w-3.5 text-cyan-400" /> WIND-TUNNEL VELOCITY
                </span>
                <span className="font-mono text-sm font-bold text-cyan-300 drop-shadow-[0_0_8px_rgba(34,211,238,0.6)]">
                  {velocity} <span className="text-[9px] text-slate-500">KM/H</span>
                </span>
              </div>
              <input
                type="range"
                min="0"
                max="350"
                step="5"
                value={velocity}
                onChange={(e) => setVelocity(Number(e.target.value))}
                className="hud-range mt-4 w-full"
                style={{
                  background: `linear-gradient(90deg, #0ea5e9 0%, #22d3ee ${(velocity / 350) * 100}%, rgba(255,255,255,0.1) ${(velocity / 350) * 100}%)`,
                }}
              />
              <div className="mt-2 flex justify-between font-mono text-[9px] text-slate-600">
                <span>0</span><span>87</span><span>175</span><span>262</span><span>350</span>
              </div>
              <div className="mt-3 grid grid-cols-3 gap-1.5">
                {[150, 220, 300].map((v) => (
                  <button
                    key={v}
                    onClick={() => setVelocity(v)}
                    className={`rounded-md border py-1 font-mono text-[10px] tracking-wider transition-all ${
                      velocity === v
                        ? 'border-cyan-400/60 bg-cyan-400/10 text-cyan-300 shadow-[0_0_10px_rgba(34,211,238,0.3)]'
                        : 'border-white/10 bg-white/5 text-slate-400 hover:border-cyan-400/30 hover:text-cyan-200'
                    }`}
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            {/* DRS toggle */}
            <button
              onClick={() => setDrsOpen((o) => !o)}
              className={`${panel} group flex w-full items-center justify-between p-4 transition-all duration-300 ${
                drsOpen
                  ? 'border-red-500/50 shadow-[0_0_25px_rgba(239,68,68,0.3)]'
                  : 'hover:border-red-500/30'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-lg border transition-all duration-300 ${
                    drsOpen
                      ? 'border-red-400/60 bg-red-500/15 shadow-[0_0_14px_rgba(239,68,68,0.5)]'
                      : 'border-white/15 bg-white/5'
                  }`}
                >
                  <Power className={`h-5 w-5 transition-colors ${drsOpen ? 'text-red-400' : 'text-slate-400'}`} />
                </div>
                <div className="text-left">
                  <div className={`text-sm font-bold tracking-wider ${drsOpen ? 'text-red-300' : 'text-slate-200'}`}>
                    DRS {drsOpen ? 'OPEN' : 'CLOSED'}
                  </div>
                  <div className="font-mono text-[9px] tracking-[0.2em] text-slate-500">
                    DRAG REDUCTION SYSTEM — REAR FLAP
                  </div>
                </div>
              </div>
              <span
                className={`rounded-md border px-2 py-1 font-mono text-[10px] font-bold tracking-wider ${
                  drsOpen ? 'border-red-400/50 bg-red-500/10 text-red-300' : 'border-white/10 text-slate-500'
                }`}
              >
                {drsOpen ? '−30% DRAG' : 'STANDBY'}
              </span>
            </button>

            {/* Aero telemetry toggles */}
            <div className={`${panel} p-4`}>
              <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-slate-500">
                <ScanLine className="h-3.5 w-3.5 text-blue-400" /> AERO TELEMETRY TOGGLES
              </div>
              <div className="mt-3 space-y-3">
                {[
                  { icon: Wind, label: 'Airflow Particles', sub: 'Canvas streamline render', on: showAirflow, fn: () => setShowAirflow((s) => !s), color: '#22d3ee' },
                  { icon: Layers, label: 'HUD Grid Overlay', sub: 'Reference flow field grid', on: showGrid, fn: () => setShowGrid((s) => !s), color: '#60a5fa' },
                ].map((t) => (
                  <div key={t.label} className="flex items-center justify-between rounded-lg border border-white/10 bg-black/20 px-3 py-2.5">
                    <div className="flex items-center gap-2.5">
                      <t.icon className="h-4 w-4 text-slate-400" />
                      <div>
                        <div className="text-xs font-semibold text-slate-200">{t.label}</div>
                        <div className="font-mono text-[8px] tracking-widest text-slate-600">{t.sub.toUpperCase()}</div>
                      </div>
                    </div>
                    <Switch on={t.on} onClick={t.fn} color={t.color} />
                  </div>
                ))}
              </div>
            </div>

            {/* Hotspot selector */}
            <div className={`${panel} p-4`}>
              <div className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-slate-500">
                <Crosshair className="h-3.5 w-3.5 text-red-400" /> COMPONENT SELECTOR
              </div>
              <div className="mt-3 space-y-2">
                {Object.values(PARTS).map((p) => {
                  const isActive = activePart === p.id;
                  return (
                    <button
                      key={p.id}
                      onClick={() => setActivePart(p.id)}
                      className="flex w-full items-center justify-between rounded-lg border px-3 py-2.5 text-left transition-all duration-300"
                      style={{
                        borderColor: isActive ? `${p.color}66` : 'rgba(255,255,255,0.1)',
                        background: isActive ? `${p.color}12` : 'rgba(255,255,255,0.03)',
                        boxShadow: isActive ? `0 0 15px ${p.color}33` : 'none',
                      }}
                    >
                      <div className="flex items-center gap-3">
                        <CircleDot
                          className="h-4 w-4 transition-colors"
                          style={{ color: isActive ? p.color : '#475569' }}
                        />
                        <div>
                          <div className="text-xs font-bold tracking-wider" style={{ color: isActive ? '#fff' : '#cbd5e1' }}>
                            {p.label}
                          </div>
                          <div className="font-mono text-[8px] tracking-[0.2em] text-slate-500">{p.sub.toUpperCase()}</div>
                        </div>
                      </div>
                      <span
                        className="font-mono text-[9px] tracking-widest"
                        style={{ color: isActive ? p.color : '#475569' }}
                      >
                        {isActive ? '● LOCKED' : '○ SELECT'}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </section>
        </main>

        {/* --------------------------------- FOOTER --------------------------------- */}
        <footer className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 border-t border-white/10 px-4 py-4 font-mono text-[9px] tracking-[0.2em] text-slate-600">
          {[
            'PU: 1.6L V6 TURBO-HYBRID',
            'MIN WEIGHT: 798 KG',
            'ERS: 4 MJ / LAP',
            'FUEL FLOW: 100 KG/H',
            'TYRES: 18IN SLICK',
            'GEARBOX: 8-SPD SEAMLESS',
          ].map((s) => (
            <span key={s} className="flex items-center gap-2">
              <span className="h-1 w-1 rounded-full bg-cyan-500/60" /> {s}
            </span>
          ))}
        </footer>
      </div>
    </div>
  );
}
