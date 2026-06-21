"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Users, Workflow, Wallet, Package, Sparkles, BarChart3, ShoppingCart,
  MessageCircle, UserPlus, ShieldCheck, Layers, ArrowRight, Check, Zap, Rocket,
  Mail, ListTodo, MoreHorizontal,
} from "lucide-react";

/* Tipo mínimo para los íconos de Lucide (evita depender del nombre del type exportado). */
type IconType = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

function Logo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-horizontal.svg" alt="Clozr" className="h-7 w-auto" />
  );
}

/* ════════════ Campo de partículas real (canvas) ════════════
 * Red de puntos que derivan y se conectan con líneas cuando se acercan.
 * Performante: densidad capada por área, DPR ≤2, pausa con la pestaña oculta,
 * respeta prefers-reduced-motion (dibuja un cuadro estático) y limpia el RAF. */
function ParticleField() {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const LINK = 130;
    let w = 0;
    let h = 0;
    let pts: { x: number; y: number; vx: number; vy: number }[] = [];
    let raf = 0;

    const make = (n: number) =>
      Array.from({ length: n }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
      }));

    const resize = () => {
      w = canvas.clientWidth;
      h = canvas.clientHeight;
      if (!w || !h) return;
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      const n = Math.min(110, Math.max(28, Math.floor((w * h) / 16000)));
      if (pts.length === 0 || Math.abs(pts.length - n) > 14) pts = make(n);
      else
        for (const p of pts) {
          if (p.x > w) p.x = Math.random() * w;
          if (p.y > h) p.y = Math.random() * h;
        }
    };

    const draw = () => {
      ctx.clearRect(0, 0, w, h);
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i]!;
        for (let j = i + 1; j < pts.length; j++) {
          const q = pts[j]!;
          const dx = p.x - q.x;
          const dy = p.y - q.y;
          const d2 = dx * dx + dy * dy;
          if (d2 < LINK * LINK) {
            const a = (1 - Math.sqrt(d2) / LINK) * 0.18;
            ctx.strokeStyle = `rgba(225,29,72,${a})`;
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(p.x, p.y);
            ctx.lineTo(q.x, q.y);
            ctx.stroke();
          }
        }
      }
      for (const p of pts) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1.4, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(225,29,72,0.5)";
        ctx.fill();
      }
    };

    const step = () => {
      for (const p of pts) {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0 || p.x > w) p.vx *= -1;
        if (p.y < 0 || p.y > h) p.vy *= -1;
      }
      draw();
      raf = requestAnimationFrame(step);
    };

    const start = () => {
      cancelAnimationFrame(raf);
      if (reduce) draw();
      else raf = requestAnimationFrame(step);
    };
    const onVis = () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else start();
    };

    resize();
    start();
    window.addEventListener("resize", resize);
    document.addEventListener("visibilitychange", onVis);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
    };
  }, []);

  return <canvas ref={ref} className="lp-canvas" aria-hidden />;
}

/* ════════════ Navbar (sticky, blur al hacer scroll) ════════════ */
function SiteNav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className={`lp-nav sticky top-0 z-50 ${scrolled ? "scrolled" : ""}`}>
      <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        <Logo />
        <nav className="hidden items-center gap-9 text-sm text-white/55 md:flex">
          <a href="#producto" className="transition-colors hover:text-white">Producto</a>
          <a href="#flujo" className="transition-colors hover:text-white">Cómo funciona</a>
          <a href="#precios" className="transition-colors hover:text-white">Precios</a>
        </nav>
        <div className="flex items-center gap-3">
          <Link href="/app" className="text-sm font-medium text-white/60 transition-colors hover:text-white">
            Ingresar
          </Link>
          <Link
            href="/app"
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Crear cuenta
          </Link>
        </div>
      </div>
    </header>
  );
}

/* ════════════ Hero: escena tipo sistema operativo + software financiero ════════════ */
const NAV_MOCK: { label: string; Icon: IconType; active?: boolean }[] = [
  { label: "Resumen", Icon: BarChart3, active: true },
  { label: "Pipeline", Icon: Workflow },
  { label: "Clientes", Icon: Users },
  { label: "Ventas", Icon: ShoppingCart },
  { label: "Caja", Icon: Wallet },
  { label: "Inventario", Icon: Package },
];

const METRICS: { label: string; value: string; delta: string }[] = [
  { label: "Ventas", value: "$98.540.000", delta: "+28%" },
  { label: "Nuevos clientes", value: "124", delta: "+18%" },
  { label: "Oportunidades", value: "32", delta: "+12%" },
  { label: "Ticket promedio", value: "$306.700", delta: "+8%" },
];

const STAGES: { n: string; c: string; rows: number }[] = [
  { n: "Contacto", c: "12", rows: 2 },
  { n: "Calificación", c: "8", rows: 2 },
  { n: "Propuesta", c: "6", rows: 2 },
  { n: "Negociación", c: "4", rows: 1 },
  { n: "Cierre", c: "2", rows: 1 },
];

const DOCK: { label: string; Icon: IconType }[] = [
  { label: "WhatsApp", Icon: MessageCircle },
  { label: "Email", Icon: Mail },
  { label: "Tareas", Icon: ListTodo },
  { label: "Reportes", Icon: BarChart3 },
  { label: "Más", Icon: MoreHorizontal },
];

/* Mini sparkline reutilizable. */
function Spark({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 30" className={className} fill="none" preserveAspectRatio="none" aria-hidden>
      <polyline
        points="0,24 16,20 30,23 46,13 62,17 80,8 98,12 120,4"
        stroke="#E11D48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.85"
      />
    </svg>
  );
}

function HeroWindow() {
  return (
    <div className="lp-scene-wrap">
    <div className="lp-scene relative mx-auto mt-16 max-w-5xl px-2 sm:px-0">
      {/* halo rojo + piso reflectante */}
      <div
        className="pointer-events-none absolute -inset-x-16 -top-12 bottom-0 -z-10 opacity-80"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(225,29,72,0.16), transparent 70%)" }}
      />
      <div className="lp-floor pointer-events-none absolute -bottom-12 left-1/2 -z-10 hidden h-24 w-[78%] -translate-x-1/2 xl:block" />

      {/* Ventana principal — "Resumen del negocio" */}
      <div className="lp-glass lp-shadow lp-glow relative overflow-hidden rounded-2xl">
        <div className="flex items-center gap-3 border-b border-white/10 px-4 py-3">
          <div className="flex gap-1.5">
            <span className="h-3 w-3 rounded-full bg-[#ff5f57]/80" />
            <span className="h-3 w-3 rounded-full bg-[#febc2e]/80" />
            <span className="h-3 w-3 rounded-full bg-[#28c840]/80" />
          </div>
          <div className="ml-2 flex items-center gap-2 text-xs text-white/45">
            <Layers size={13} strokeWidth={1.8} /> Clozr — Mi negocio
          </div>
          <div className="ml-auto hidden items-center rounded-md border border-white/10 bg-white/5 px-3 py-1 text-[11px] text-white/35 sm:flex">
            Buscar…
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-[170px_1fr]">
          {/* Rail lateral */}
          <aside className="hidden flex-col gap-1 border-r border-white/10 p-3 md:flex">
            {NAV_MOCK.map(({ label, Icon, active }) => (
              <div
                key={label}
                className={`flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] ${
                  active ? "bg-primary/15 text-white" : "text-white/45"
                }`}
              >
                <Icon size={15} strokeWidth={1.8} className={active ? "text-primary" : ""} />
                {label}
              </div>
            ))}
          </aside>

          {/* Contenido */}
          <div className="p-4 sm:p-5">
            <h3 className="text-sm font-semibold text-white">Resumen del negocio</h3>

            {/* Métricas */}
            <div className="mt-3 grid grid-cols-2 gap-2.5 lg:grid-cols-4">
              {METRICS.map((m) => (
                <div key={m.label} className="rounded-xl border border-white/8 bg-white/[0.03] p-3">
                  <div className="text-[10px] text-white/40">{m.label}</div>
                  <div className="mt-1 text-[15px] font-bold text-white">{m.value}</div>
                  <div className="text-[10px] font-medium text-[#10B981]">
                    {m.delta} <span className="text-white/30">vs mes ant.</span>
                  </div>
                  <Spark className="mt-1.5 h-5 w-full" />
                </div>
              ))}
            </div>

            {/* Pipeline */}
            <div className="mt-4">
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[12px] font-medium text-white/70">Pipeline de ventas</span>
                <span className="hidden text-[10px] text-white/30 sm:inline">$ 98.4M en juego</span>
              </div>
              <div className="cz-noscrollbar -mx-1 flex gap-2 overflow-x-auto px-1">
                {STAGES.map((s) => (
                  <div key={s.n} className="min-w-[104px] flex-1 rounded-xl border border-white/8 bg-white/[0.02] p-2.5">
                    <div className="flex items-center justify-between">
                      <span className="whitespace-nowrap text-[10px] font-medium text-white/60">{s.n}</span>
                      <span className="text-[9px] text-white/30">{s.c}</span>
                    </div>
                    <div className="mt-2 space-y-1.5">
                      {Array.from({ length: s.rows }).map((_, r) => (
                        <div key={r} className="h-7 rounded-md border border-white/10 bg-white/[0.04]" />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Paneles flotantes (solo ≥xl, donde hay aire para que no rompan) ── */}
      {/* Clientes (izquierda) */}
      <div className="lp-glass lp-pop lp-platform absolute -left-12 top-24 hidden w-56 rounded-xl p-3.5 xl:block">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-white">Clientes</span>
          <span className="text-[10px] text-primary">512</span>
        </div>
        <div className="mt-3 flex flex-col gap-2.5">
          {[["Distribuidora Norte", "Distribución"], ["Grupo Casarino", "Construcción"], ["Retail Express", "Retail"]].map(
            ([n, r]) => (
              <div key={n} className="flex items-center gap-2.5">
                <span className="h-7 w-7 shrink-0 rounded-full bg-primary/15" />
                <div className="min-w-0">
                  <div className="truncate text-[11px] font-medium text-white/85">{n}</div>
                  <div className="text-[10px] text-white/35">{r}</div>
                </div>
              </div>
            ),
          )}
        </div>
      </div>

      {/* Caja (derecha arriba) */}
      <div className="lp-glass lp-pop-2 absolute -right-12 top-12 hidden w-52 rounded-xl p-3.5 xl:block">
        <span className="text-xs font-semibold text-white">Caja</span>
        <div className="mt-2 text-[10px] text-white/40">Saldo disponible</div>
        <div className="text-lg font-bold text-white">$ 34.850.000</div>
        <div className="text-[10px] font-medium text-[#10B981]">+15% vs mes ant.</div>
        <div className="mt-3 flex items-center justify-between border-t border-white/10 pt-2 text-[10px]">
          <span className="text-[#10B981]">↑ Ingresos</span>
          <span className="text-white/60">$ 4.250.000</span>
        </div>
      </div>

      {/* IA (derecha abajo) */}
      <div className="lp-glass lp-glow lp-pop absolute -right-6 -bottom-2 hidden w-56 rounded-xl p-3.5 xl:block">
        <div className="flex items-center gap-2">
          <Sparkles size={14} strokeWidth={1.8} className="text-primary" />
          <span className="text-xs font-semibold text-white">IA de Clozr</span>
          <span className="ml-auto rounded bg-primary/15 px-1.5 py-0.5 text-[9px] text-primary">Beta</span>
        </div>
        <p className="mt-2 text-[11px] leading-relaxed text-white/55">
          Detecté 3 oportunidades con alta probabilidad de cierre esta semana.
        </p>
        <div className="mt-2.5 rounded-md bg-primary/15 py-1.5 text-center text-[10px] font-semibold text-primary">
          Ver oportunidades
        </div>
      </div>

      {/* Dock flotante */}
      <div className="lp-glass absolute -bottom-7 left-1/2 hidden -translate-x-1/2 items-end gap-1 rounded-2xl px-2.5 py-2 xl:flex">
        {DOCK.map(({ label, Icon }) => (
          <div key={label} className="group flex w-14 flex-col items-center gap-1 rounded-xl px-1 py-1.5 transition-colors hover:bg-white/5">
            <Icon size={18} strokeWidth={1.8} className="text-white/70 transition-colors group-hover:text-primary" />
            <span className="text-[9px] text-white/40">{label}</span>
          </div>
        ))}
      </div>
    </div>
    </div>
  );
}

/* ════════════ Funciones ════════════ */
const FEATURES: { title: string; desc: string; Icon: IconType }[] = [
  { title: "Clientes ordenados", desc: "Toda tu cartera en un lugar: historial, notas y próximos pasos. Sin planillas perdidas.", Icon: Users },
  { title: "Pipeline visual", desc: "Arrastrá cada oportunidad por sus etapas. Ves de un vistazo qué cierra y qué se enfría.", Icon: Workflow },
  { title: "Ventas y cobranzas", desc: "Registrá ventas, pagos y saldos. Sabé quién te debe y cuánto, al instante.", Icon: ShoppingCart },
  { title: "Caja diaria", desc: "Abrí y cerrá caja con arqueo por moneda. Ingresos y egresos siempre cuadrados.", Icon: Wallet },
  { title: "Inventario por rubro", desc: "Catálogo con stock, costos y precios por tipo de cliente. Plantillas según tu negocio.", Icon: Package },
  { title: "Clozr de noche · IA", desc: "Cada mañana te deja listos los seguimientos de los clientes que se están enfriando.", Icon: Sparkles },
];

function FeatureCard({ title, desc, Icon }: { title: string; desc: string; Icon: IconType }) {
  return (
    <div className="lp-glass lp-lift rounded-2xl p-6">
      <div className="grid h-11 w-11 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
        <Icon size={20} strokeWidth={1.8} />
      </div>
      <h3 className="mt-5 text-[15px] font-semibold text-white">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-white/50">{desc}</p>
    </div>
  );
}

/* ════════════ Flujo de una venta ════════════ */
const FLOW: { label: string; Icon: IconType }[] = [
  { label: "Lead", Icon: UserPlus },
  { label: "Cliente", Icon: Users },
  { label: "Seguimiento", Icon: MessageCircle },
  { label: "Venta", Icon: ShoppingCart },
  { label: "Caja", Icon: Wallet },
  { label: "Reportes", Icon: BarChart3 },
];

function FlowSection() {
  return (
    <section id="flujo" className="mx-auto max-w-6xl px-6 py-28">
      <div className="text-center">
        <SectionKicker>El flujo</SectionKicker>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
          Así fluye una venta en Clozr
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-white/50">
          De un contacto suelto a plata en la caja. Todo el recorrido vive en un solo lugar.
        </p>
      </div>

      <div className="relative mt-16">
        {/* línea de flujo animada detrás (desktop) */}
        <div className="lp-flowline absolute left-0 right-0 top-7 hidden h-px md:block" />
        <div className="flex flex-wrap items-start justify-center gap-x-2 gap-y-8 md:flex-nowrap md:justify-between">
          {FLOW.map((s, i) => (
            <div key={s.label} className="flex items-center md:flex-1 md:flex-col">
              <div className="flex flex-col items-center text-center">
                <div
                  className="lp-glass relative grid h-14 w-14 place-items-center rounded-2xl text-primary"
                  style={{ boxShadow: "0 0 32px rgba(225,29,72,0.10)" }}
                >
                  <s.Icon size={22} strokeWidth={1.8} />
                </div>
                <span className="mt-3 text-sm font-medium text-white/75">{s.label}</span>
              </div>
              {i < FLOW.length - 1 && (
                <ArrowRight size={16} strokeWidth={1.8} className="mx-3 shrink-0 text-white/25 md:hidden" />
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════ Todo conectado (sistema de nodos en grilla) ════════════ */
const BOX_W = 760;
const BOX_H = 560;
const HUB = { x: 380, y: 290, w: 158, h: 104 };
const NODE_CARDS: {
  id: string; title: string; sub: string; stat: string; unit: string; delta: string; Icon: IconType; x: number; y: number;
}[] = [
  { id: "clientes", title: "Clientes", sub: "Tu cartera ordenada", stat: "1.250", unit: "activos", delta: "+18%", Icon: Users, x: 150, y: 86 },
  { id: "ventas", title: "Ventas", sub: "Pipeline que avanza", stat: "32", unit: "oportunidades", delta: "+24%", Icon: ShoppingCart, x: 380, y: 86 },
  { id: "equipo", title: "Equipo", sub: "Tu equipo alineado", stat: "48", unit: "tareas hoy", delta: "+16%", Icon: ShieldCheck, x: 610, y: 86 },
  { id: "inventario", title: "Inventario", sub: "Stock en tiempo real", stat: "1.847", unit: "productos", delta: "+3%", Icon: Package, x: 250, y: 478 },
  { id: "ia", title: "IA de Clozr", sub: "Inteligencia que vende", stat: "7", unit: "cierres probables", delta: "+35%", Icon: Sparkles, x: 510, y: 478 },
];
/* Conexiones ortogonales (●──●──●) entre el hub y las tarjetas. */
const NODE_SEG: [number, number, number, number][] = [
  [150, 160, 150, 205], [380, 160, 380, 205], [610, 160, 610, 205], // bajadas (fila superior → bus)
  [150, 205, 610, 205],                                             // bus superior
  [380, 205, 380, 238],                                             // hub ↔ bus superior
  [380, 342, 380, 375],                                             // hub ↔ bus inferior
  [250, 375, 510, 375],                                             // bus inferior
  [250, 375, 250, 400], [510, 375, 510, 400],                       // subidas (bus → fila inferior)
];
const NODE_DOTS: [number, number][] = [
  [150, 205], [380, 205], [610, 205], [380, 238], [380, 342], [250, 375], [510, 375],
];

function NodeCard({ title, sub, stat, unit, delta, Icon }: {
  title: string; sub: string; stat: string; unit: string; delta: string; Icon: IconType;
}) {
  return (
    <div className="lp-glass lp-platform lp-lift w-full rounded-2xl p-4">
      <div className="flex items-center gap-2.5">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-primary/25 bg-primary/10 text-primary">
          <Icon size={18} strokeWidth={1.8} />
        </span>
        <div className="min-w-0">
          <div className="text-[13px] font-semibold text-white">{title}</div>
          <div className="truncate text-[10px] text-white/40">{sub}</div>
        </div>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <div className="text-xl font-bold leading-none text-white">{stat}</div>
          <div className="mt-1 text-[10px] text-white/40">{unit}</div>
        </div>
        <span className="text-[10px] font-medium text-[#10B981]">{delta}</span>
      </div>
      <Spark className="mt-2.5 h-5 w-full" />
    </div>
  );
}

function ConnectedSection() {
  return (
    <section id="ecosistema" className="mx-auto max-w-6xl px-6 py-28">
      <div className="text-center">
        <SectionKicker>El ecosistema</SectionKicker>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
          No son módulos sueltos. Es un solo sistema.
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-white/50">
          Clientes, ventas, equipo, inventario e IA comparten la misma información.
          Cargás un dato una vez y vive en todo tu negocio — sin exportar, sin duplicar, sin planillas.
        </p>
      </div>

      {/* Composición de nodos (desktop ≥lg) */}
      <div className="mt-16 hidden justify-center lg:flex">
        <div className="relative" style={{ width: BOX_W, height: BOX_H }}>
          {/* Conexiones + nodos luminosos */}
          <svg viewBox={`0 0 ${BOX_W} ${BOX_H}`} width={BOX_W} height={BOX_H} className="absolute inset-0 overflow-visible" fill="none">
            {NODE_SEG.map(([x1, y1, x2, y2], i) => (
              <line key={`b${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(255,255,255,0.08)" strokeWidth={1} />
            ))}
            {NODE_SEG.map(([x1, y1, x2, y2], i) => (
              <line key={`g${i}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="rgba(225,29,72,0.55)" strokeWidth={1.25} className="lp-glow-line lp-dash" />
            ))}
            {NODE_DOTS.map(([cx, cy], i) => (
              <circle key={`d${i}`} cx={cx} cy={cy} r={3.5} className="lp-node" />
            ))}
          </svg>

          {/* Tarjetas-stat */}
          {NODE_CARDS.map((n) => (
            <div key={n.id} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: n.x, top: n.y, width: 196 }}>
              <NodeCard {...n} />
            </div>
          ))}

          {/* Hub central */}
          <div
            className="lp-glass lp-glow absolute grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-2xl"
            style={{ left: HUB.x, top: HUB.y, width: HUB.w, height: HUB.h, borderColor: "rgba(225,29,72,0.45)" }}
          >
            <div className="text-center">
              <span className="mx-auto grid h-9 w-9 place-items-center rounded-xl bg-primary/15 text-primary">
                <Layers size={18} strokeWidth={1.8} />
              </span>
              <div className="mt-1.5 text-sm font-bold text-white">Clozr</div>
              <div className="text-[10px] text-white/40">Tu negocio, conectado</div>
            </div>
          </div>
        </div>
      </div>

      {/* Fallback mobile: hub + grilla simple */}
      <div className="mt-12 lg:hidden">
        <div className="lp-glass lp-glow mx-auto mb-4 flex max-w-xs items-center justify-center gap-2 rounded-2xl px-4 py-3">
          <Layers size={16} strokeWidth={1.8} className="text-primary" />
          <span className="text-sm font-bold text-white">Clozr</span>
          <span className="text-xs text-white/40">· Tu negocio, conectado</span>
        </div>
        <div className="grid grid-cols-2 gap-3">
          {NODE_CARDS.map((n) => (
            <NodeCard key={n.id} {...n} />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ════════════ Precios ════════════ */
const PLANS: {
  name: string; monthly: number; Icon: IconType; perks: string[]; cta: string; highlight: boolean;
}[] = [
  {
    name: "Free", monthly: 0, Icon: Sparkles,
    perks: ["1 empleado", "Clientes, pipeline y ventas", "Caja diaria", "Para arrancar solo"],
    cta: "Crear cuenta", highlight: false,
  },
  {
    name: "Pro", monthly: 20, Icon: Zap,
    perks: ["2 empleados incluidos", "Inventario, deudas y tareas", "Reportes del negocio", "Multi-moneda + WhatsApp", "Roles y permisos"],
    cta: "Probar 14 días", highlight: true,
  },
  {
    name: "Team", monthly: 45, Icon: Rocket,
    perks: ["5 empleados incluidos", "Todo lo de Pro", "Clozr de noche (IA)", "Reportes avanzados", "Soporte prioritario"],
    cta: "Probar 14 días", highlight: false,
  },
];

function Pricing() {
  const [annual, setAnnual] = useState(false);
  return (
    <section id="precios" className="mx-auto max-w-6xl px-6 py-28">
      <div className="text-center">
        <SectionKicker>Precios</SectionKicker>
        <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
          Precio simple, sin sorpresas
        </h2>
        <p className="mx-auto mt-4 max-w-lg text-white/50">
          Empezá gratis. Pagás recién cuando sumás a tu equipo.
        </p>

        {/* Toggle Mensual / Anual */}
        <div className="mt-8 flex justify-center">
          <div className="inline-flex items-center rounded-full border border-white/10 bg-white/5 p-1 text-sm">
            <button
              onClick={() => setAnnual(false)}
              className={`rounded-full px-4 py-1.5 font-medium transition-colors ${!annual ? "bg-white text-[#0b0b0d]" : "text-white/55 hover:text-white"}`}
            >
              Mensual
            </button>
            <button
              onClick={() => setAnnual(true)}
              className={`flex items-center gap-2 rounded-full px-4 py-1.5 font-medium transition-colors ${annual ? "bg-white text-[#0b0b0d]" : "text-white/55 hover:text-white"}`}
            >
              Anual
              <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">2 meses gratis</span>
            </button>
          </div>
        </div>
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {PLANS.map((p) => {
          const free = p.monthly === 0;
          const price = free ? "Gratis" : annual ? `US$ ${p.monthly * 10}` : `US$ ${p.monthly}`;
          const tag = free ? "" : annual ? "/ año" : "/ mes";
          const save = !free && annual ? `2 meses gratis · ahorrás US$ ${p.monthly * 2}` : "";
          return (
          <div
            key={p.name}
            className={`lp-glass lp-lift relative rounded-2xl p-7 ${
              p.highlight ? "lp-glow" : ""
            }`}
            style={p.highlight ? { borderColor: "rgba(225,29,72,0.45)" } : undefined}
          >
            {p.highlight && (
              <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                Más elegido
              </span>
            )}
            <div className="flex items-center gap-2.5">
              <span className={`grid h-9 w-9 place-items-center rounded-lg ${p.highlight ? "bg-primary text-white" : "bg-white/5 text-white/70"}`}>
                <p.Icon size={17} strokeWidth={1.8} />
              </span>
              <h3 className="text-lg font-bold text-white">{p.name}</h3>
            </div>
            <div className="mt-5 flex items-baseline gap-1.5">
              <span className="text-3xl font-extrabold tracking-tight text-white">{price}</span>
              {tag && <span className="text-sm text-white/40">{tag}</span>}
            </div>
            <div className="mt-1.5 h-4 text-xs font-medium text-primary">{save}</div>
            <ul className="mt-6 space-y-3 text-sm">
              {p.perks.map((perk) => (
                <li key={perk} className="flex items-center gap-2.5 text-white/60">
                  <Check size={15} strokeWidth={2} className="shrink-0 text-primary" /> {perk}
                </li>
              ))}
            </ul>
            <Link
              href="/app"
              className={`mt-8 block rounded-lg py-2.5 text-center text-sm font-semibold transition-colors ${
                p.highlight
                  ? "bg-primary text-white hover:bg-primary-hover"
                  : "border border-white/10 bg-white/5 text-white hover:bg-white/10"
              }`}
            >
              {p.cta}
            </Link>
          </div>
          );
        })}
      </div>

      <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-white/35">
        + US$ 5 por empleado extra · + US$ 10 por sucursal · 2 meses gratis pagando al año · 14 días de prueba.
        <br />
        Precios en dólares — los pagás en pesos con Mercado Pago, al cambio del día.
      </p>
    </section>
  );
}

/* ════════════ helpers ════════════ */
function SectionKicker({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white/45">
      <span className="h-1.5 w-1.5 rounded-full bg-primary lp-pulse" />
      {children}
    </span>
  );
}

/* ════════════ Página ════════════ */
export default function Home() {
  return (
    <div className="lp-root flex min-h-full flex-col">
      <div className="lp-atmos" aria-hidden />
      <ParticleField />

      <SiteNav />

      {/* Hero */}
      <section className="relative px-6 pt-20 pb-8 md:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="lp-rise inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3.5 py-1.5 text-xs font-medium text-white/55" style={{ animationDelay: "0ms" }}>
            <span className="h-1.5 w-1.5 rounded-full bg-primary" />
            Hecho en LATAM · calidad internacional
          </span>
          <h1 className="lp-rise mt-7 text-5xl font-extrabold leading-[1.05] tracking-tight text-white md:text-7xl" style={{ animationDelay: "60ms" }}>
            Dejá el Excel.
            <br />
            <span className="bg-gradient-to-r from-primary to-primary-hover bg-clip-text text-transparent">
              Cerrá más ventas.
            </span>
          </h1>
          <p className="lp-rise mx-auto mt-7 max-w-xl text-lg leading-relaxed text-white/55" style={{ animationDelay: "120ms" }}>
            El sistema operativo para tu negocio.
            <br />
            Clientes, ventas, caja e inventario en un solo lugar.
          </p>
          <div className="lp-rise mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row" style={{ animationDelay: "180ms" }}>
            <Link
              href="/app"
              className="group flex w-full items-center justify-center gap-2 rounded-lg bg-primary px-6 py-3.5 text-base font-semibold text-white transition-colors hover:bg-primary-hover sm:w-auto"
            >
              Empezar gratis
              <ArrowRight size={17} strokeWidth={2} className="transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#flujo"
              className="lp-glass w-full rounded-lg px-6 py-3.5 text-base font-semibold text-white/85 transition-colors hover:text-white sm:w-auto"
            >
              Ver cómo funciona
            </a>
          </div>
          <p className="lp-rise mt-5 text-sm text-white/35" style={{ animationDelay: "240ms" }}>
            Sin tarjeta · Listo en 2 minutos
          </p>
        </div>

        <HeroWindow />
      </section>

      {/* Funciones */}
      <section id="producto" className="mx-auto max-w-6xl px-6 py-28">
        <div className="text-center">
          <SectionKicker>El producto</SectionKicker>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
            Todo tu negocio, en un sistema
          </h2>
          <p className="mx-auto mt-4 max-w-lg text-white/50">
            Sin las 200 funciones que nunca vas a usar. Solo lo que mueve la aguja.
          </p>
        </div>
        <div className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>
      </section>

      <FlowSection />

      <ConnectedSection />

      <Pricing />

      {/* CTA final */}
      <section className="mx-auto w-full max-w-6xl px-6 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-white/10 p-14 text-center md:p-20">
          <div
            className="pointer-events-none absolute inset-0 -z-10"
            style={{ background: "radial-gradient(60% 120% at 50% 0%, rgba(225,29,72,0.16), transparent 70%)" }}
          />
          <h2 className="text-3xl font-bold tracking-tight text-white md:text-5xl">
            Tu próxima venta empieza acá.
          </h2>
          <p className="mx-auto mt-5 max-w-md text-white/55">
            Dejá atrás las planillas y administrá tu negocio desde un solo lugar.
          </p>
          <Link
            href="/app"
            className="mt-10 inline-flex items-center gap-2 rounded-lg bg-primary px-8 py-3.5 text-base font-semibold text-white transition-colors hover:bg-primary-hover"
          >
            Crear cuenta gratis
            <ArrowRight size={17} strokeWidth={2} />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-white/10">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-10 text-sm text-white/35 sm:flex-row">
          <Logo />
          <span>© 2026 Clozr · Hecho en LATAM.</span>
        </div>
      </footer>
    </div>
  );
}
