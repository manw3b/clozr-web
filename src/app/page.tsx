"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Users, Workflow, Wallet, Package, Sparkles, BarChart3, ShoppingCart,
  MessageCircle, UserPlus, ShieldCheck, Layers, ArrowRight, Check, Zap, Rocket,
} from "lucide-react";

/* Tipo mínimo para los íconos de Lucide (evita depender del nombre del type exportado). */
type IconType = React.ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;

function Logo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-horizontal.svg" alt="Clozr" className="h-7 w-auto" />
  );
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

/* ════════════ Hero: composición tipo sistema operativo ════════════ */
const NAV_MOCK: { label: string; Icon: IconType; active?: boolean }[] = [
  { label: "Mi día", Icon: Sparkles },
  { label: "Clientes", Icon: Users },
  { label: "Pipeline", Icon: Workflow, active: true },
  { label: "Ventas", Icon: ShoppingCart },
  { label: "Caja", Icon: Wallet },
  { label: "Inventario", Icon: Package },
  { label: "Reportes", Icon: BarChart3 },
];

const KANBAN: { title: string; tone: string; cards: { name: string; sub: string; amount: string }[] }[] = [
  {
    title: "Contactado", tone: "#3B82F6",
    cards: [
      { name: "Sofía R.", sub: "Consulta", amount: "$120.000" },
      { name: "Local Centro", sub: "Mayorista", amount: "$80.000" },
    ],
  },
  {
    title: "Negociando", tone: "#E11D48",
    cards: [
      { name: "Martín G.", sub: "Presupuesto", amount: "$320.000" },
      { name: "Belén A.", sub: "Reposición", amount: "$540.000" },
    ],
  },
  {
    title: "Cerrado", tone: "#10B981",
    cards: [{ name: "Carla P.", sub: "Pagado", amount: "$210.000" }],
  },
];

function HeroWindow() {
  return (
    <div className="relative mx-auto mt-16 max-w-5xl px-2 sm:px-0">
      {/* halo rojo detrás de la ventana */}
      <div
        className="pointer-events-none absolute -inset-x-10 -top-10 bottom-0 -z-10 opacity-70"
        style={{ background: "radial-gradient(60% 50% at 50% 0%, rgba(225,29,72,0.16), transparent 70%)" }}
      />

      {/* Ventana principal (OS) */}
      <div className="lp-glass lp-shadow lp-glow overflow-hidden rounded-2xl">
        {/* Barra de título */}
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

        {/* Cuerpo: rail + contenido */}
        <div className="grid grid-cols-1 md:grid-cols-[180px_1fr]">
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

          {/* Contenido: mini pipeline */}
          <div className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-white">Pipeline</h3>
              <div className="flex gap-2 text-[11px]">
                {[["Hoy", "$420.000"], ["Abiertos", "12"], ["Por cerrar", "3"]].map(([k, v]) => (
                  <div key={k} className="rounded-md border border-white/10 bg-white/5 px-2.5 py-1">
                    <span className="text-white/40">{k} </span>
                    <span className="font-semibold text-white/80">{v}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 grid grid-cols-3 gap-3">
              {KANBAN.map((col) => (
                <div key={col.title} className="rounded-xl border border-white/8 bg-white/[0.02] p-2.5">
                  <div className="mb-2 flex items-center gap-1.5 px-1">
                    <span className="h-1.5 w-1.5 rounded-full" style={{ background: col.tone }} />
                    <span className="text-[11px] font-medium text-white/55">{col.title}</span>
                    <span className="ml-auto text-[10px] text-white/30">{col.cards.length}</span>
                  </div>
                  <div className="flex flex-col gap-2">
                    {col.cards.map((c) => (
                      <div key={c.name} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
                        <div className="text-[11px] font-medium text-white/85">{c.name}</div>
                        <div className="mt-0.5 flex items-center justify-between">
                          <span className="text-[10px] text-white/35">{c.sub}</span>
                          <span className="text-[10px] font-semibold text-white/70">{c.amount}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Cards flotantes (solo desktop, para no romper en móvil) */}
      <div className="lp-glass lp-float absolute -right-6 top-16 hidden items-center gap-3 rounded-xl px-4 py-3 lg:flex">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#10B981]/15 text-[#10B981]">
          <Check size={18} strokeWidth={2} />
        </span>
        <div>
          <div className="text-xs font-semibold text-white">Venta cerrada</div>
          <div className="text-[11px] text-[#10B981]">+ $85.000</div>
        </div>
      </div>

      <div className="lp-glass lp-float-2 absolute -left-8 bottom-12 hidden items-center gap-3 rounded-xl px-4 py-3 lg:flex">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-primary/15 text-primary">
          <Sparkles size={18} strokeWidth={1.8} />
        </span>
        <div>
          <div className="text-xs font-semibold text-white">Clozr de noche</div>
          <div className="text-[11px] text-white/45">3 seguimientos listos</div>
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

/* ════════════ Todo conectado (hub-spoke) ════════════ */
const HUB_SIZE = 460;
const HUB_R = 166;
const HUB_C = HUB_SIZE / 2;
const SATELLITES: { label: string; Icon: IconType; x: number; y: number }[] = (
  [
    { label: "Clientes", Icon: Users },
    { label: "Ventas", Icon: ShoppingCart },
    { label: "Inventario", Icon: Package },
    { label: "Caja", Icon: Wallet },
    { label: "Equipo", Icon: ShieldCheck },
    { label: "IA", Icon: Sparkles },
  ] as { label: string; Icon: IconType }[]
).map((s, i) => {
  const a = ((-90 + i * 60) * Math.PI) / 180;
  return { ...s, x: HUB_C + HUB_R * Math.cos(a), y: HUB_C + HUB_R * Math.sin(a) };
});

function ConnectedSection() {
  return (
    <section id="ecosistema" className="mx-auto max-w-6xl px-6 py-28">
      <div className="grid items-center gap-14 lg:grid-cols-2">
        <div>
          <SectionKicker>El ecosistema</SectionKicker>
          <h2 className="mt-4 text-3xl font-bold tracking-tight text-white md:text-4xl">
            No son módulos sueltos.
            <br />
            Es un solo sistema.
          </h2>
          <p className="mt-5 max-w-md text-white/50">
            Clientes, ventas, inventario, caja, equipo e IA comparten la misma información.
            Cargás un dato una vez y vive en todo tu negocio — sin exportar, sin duplicar, sin planillas.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {SATELLITES.map((s) => (
              <span key={s.label} className="lp-glass inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-sm text-white/65">
                <s.Icon size={14} strokeWidth={1.8} className="text-primary" /> {s.label}
              </span>
            ))}
          </div>
        </div>

        {/* Diagrama radial (desktop ≥lg, donde la columna tiene ancho para 460px) */}
        <div className="hidden justify-center lg:flex">
          <div className="relative" style={{ width: HUB_SIZE, height: HUB_SIZE }}>
            <svg
              viewBox={`0 0 ${HUB_SIZE} ${HUB_SIZE}`}
              width={HUB_SIZE}
              height={HUB_SIZE}
              className="absolute inset-0"
              fill="none"
            >
              {SATELLITES.map((s) => (
                <g key={s.label}>
                  <line x1={HUB_C} y1={HUB_C} x2={s.x} y2={s.y} stroke="rgba(255,255,255,0.10)" strokeWidth={1} />
                  <line
                    x1={HUB_C} y1={HUB_C} x2={s.x} y2={s.y}
                    stroke="rgba(225,29,72,0.5)" strokeWidth={1} className="lp-dash"
                  />
                </g>
              ))}
            </svg>

            {/* Hub central */}
            <div
              className="lp-glass lp-glow absolute grid h-24 w-24 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full"
              style={{ left: HUB_C, top: HUB_C, borderColor: "rgba(225,29,72,0.35)" }}
            >
              <div className="grid place-items-center text-center">
                <Layers size={22} strokeWidth={1.8} className="text-primary" />
                <span className="mt-1 text-[11px] font-semibold tracking-wide text-white">Clozr</span>
              </div>
            </div>

            {/* Satélites */}
            {SATELLITES.map((s) => (
              <div
                key={s.label}
                className="absolute -translate-x-1/2 -translate-y-1/2"
                style={{ left: s.x, top: s.y }}
              >
                <div className="flex flex-col items-center gap-1.5">
                  <div className="lp-glass grid h-14 w-14 place-items-center rounded-2xl text-white/80">
                    <s.Icon size={20} strokeWidth={1.8} />
                  </div>
                  <span className="text-[11px] text-white/55">{s.label}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

/* ════════════ Precios ════════════ */
const PLANS: {
  name: string; price: string; tag: string; Icon: IconType; perks: string[]; cta: string; highlight: boolean;
}[] = [
  {
    name: "Free", price: "Gratis", tag: "", Icon: Sparkles,
    perks: ["1 empleado", "Clientes, pipeline y ventas", "Caja diaria", "Para arrancar solo"],
    cta: "Crear cuenta", highlight: false,
  },
  {
    name: "Pro", price: "US$ 20", tag: "/ mes", Icon: Zap,
    perks: ["2 empleados incluidos", "Inventario, deudas y tareas", "Reportes del negocio", "Multi-moneda + WhatsApp", "Roles y permisos"],
    cta: "Probar 14 días", highlight: true,
  },
  {
    name: "Team", price: "US$ 45", tag: "/ mes", Icon: Rocket,
    perks: ["5 empleados incluidos", "Todo lo de Pro", "Clozr de noche (IA)", "Reportes avanzados", "Soporte prioritario"],
    cta: "Probar 14 días", highlight: false,
  },
];

function Pricing() {
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
      </div>

      <div className="mt-14 grid gap-6 md:grid-cols-3">
        {PLANS.map((p) => (
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
              <span className="text-3xl font-extrabold tracking-tight text-white">{p.price}</span>
              {p.tag && <span className="text-sm text-white/40">{p.tag}</span>}
            </div>
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
        ))}
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
