import Link from "next/link";

function Logo() {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src="/logo-horizontal.svg" alt="Clozr" className="h-7 w-auto" />
  );
}

const FEATURES = [
  {
    title: "Pipeline visual",
    desc: "Arrastrá cada oportunidad por tus etapas. Ves de un vistazo qué está por cerrar y qué se enfría.",
    icon: "▦",
  },
  {
    title: "Clientes ordenados",
    desc: "Toda tu cartera en un lugar: historial, notas y próximos pasos. Sin planillas perdidas.",
    icon: "☰",
  },
  {
    title: "Ventas y cobranzas",
    desc: "Registrá ventas, pagos y saldos pendientes. Sabé quién te debe y cuánto, al instante.",
    icon: "◧",
  },
  {
    title: "Caja diaria",
    desc: "Abrí y cerrá caja con arqueo por moneda. Ingresos y egresos siempre cuadrados.",
    icon: "▤",
  },
  {
    title: "Inventario por rubro",
    desc: "Catálogo con stock, costos y precios por tipo de cliente. Con plantillas según tu negocio.",
    icon: "▥",
  },
  {
    title: "Clozr de noche · IA",
    desc: "Cada mañana te deja listos los seguimientos de los clientes que se están enfriando.",
    icon: "✦",
  },
];

const RUBROS = [
  { label: "Gastronomía", emoji: "🍔" },
  { label: "Indumentaria", emoji: "👕" },
  { label: "Kiosco y almacén", emoji: "🛒" },
  { label: "Tecnología", emoji: "📱" },
  { label: "Servicios", emoji: "🔧" },
  { label: "Salud y estética", emoji: "💅" },
];

const PLANS = [
  {
    name: "Free",
    price: "Gratis",
    tag: "",
    perks: ["1 empleado", "Clientes, pipeline y ventas", "Caja diaria", "Para arrancar solo"],
    cta: "Crear cuenta",
    highlight: false,
  },
  {
    name: "Pro",
    price: "US$ 20",
    tag: "/ mes",
    perks: [
      "2 empleados incluidos",
      "Inventario, deudas y tareas",
      "Reportes del negocio",
      "Multi-moneda + WhatsApp",
      "Roles y permisos por miembro",
    ],
    cta: "Probar 14 días",
    highlight: true,
  },
  {
    name: "Team",
    price: "US$ 45",
    tag: "/ mes",
    perks: [
      "5 empleados incluidos",
      "Todo lo de Pro",
      "Clozr de noche (IA)",
      "Reportes avanzados",
      "Soporte prioritario",
    ],
    cta: "Probar 14 días",
    highlight: false,
  },
];

export default function Home() {
  return (
    <div className="flex min-h-full flex-col">
      {/* Nav */}
      <header className="sticky top-0 z-40 border-b border-border bg-bg/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <Logo />
          <nav className="hidden items-center gap-8 text-sm text-text-muted md:flex">
            <a href="#features" className="hover:text-text">Funciones</a>
            <a href="#rubros" className="hover:text-text">Rubros</a>
            <a href="#pricing" className="hover:text-text">Precios</a>
          </nav>
          <div className="flex items-center gap-3">
            <Link href="/app" className="text-sm font-medium text-text-muted hover:text-text">
              Ingresar
            </Link>
            <Link
              href="/app"
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-hover"
            >
              Crear cuenta
            </Link>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 opacity-40"
          style={{
            background:
              "radial-gradient(600px 300px at 50% -10%, rgba(225,29,72,0.25), transparent)",
          }}
        />
        <div className="mx-auto max-w-3xl px-6 py-24 text-center md:py-32">
          <span className="inline-block rounded-full border border-border-strong bg-surface px-3 py-1 text-xs font-semibold text-text-muted">
            Hecho para comercios y PyMEs de LATAM 🌎
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Dejá el Excel.
            <br />
            <span className="text-primary-hover">Cerrá más ventas.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-text-muted">
            El CRM simple para tu negocio: clientes, ventas, caja e inventario en
            un solo lugar. Cualquiera sea tu rubro — en español y lo pagás en pesos.
          </p>
          <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Link
              href="/app"
              className="w-full rounded-lg bg-primary px-6 py-3 text-base font-semibold text-white transition hover:bg-primary-hover sm:w-auto"
            >
              Empezar gratis
            </Link>
            <a
              href="#features"
              className="w-full rounded-lg bg-surface-2 px-6 py-3 text-base font-semibold text-text transition hover:bg-border-strong sm:w-auto"
            >
              Ver cómo funciona
            </a>
          </div>
          <p className="mt-4 text-sm text-text-dim">Sin tarjeta. Listo en 2 minutos.</p>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Todo lo que tu negocio necesita
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-text-muted">
          Sin las 200 funciones que nunca vas a usar. Solo lo que mueve la aguja.
        </p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="rounded-xl border border-border bg-surface p-6 transition hover:border-border-strong"
            >
              <div className="grid h-11 w-11 place-items-center rounded-lg bg-[rgba(225,29,72,0.12)] text-xl text-primary-hover">
                {f.icon}
              </div>
              <h3 className="mt-4 font-semibold">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-text-muted">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Rubros */}
      <section id="rubros" className="border-y border-border bg-surface/40">
        <div className="mx-auto max-w-6xl px-6 py-20">
          <h2 className="text-center text-3xl font-bold tracking-tight">
            Funciona para tu rubro
          </h2>
          <p className="mx-auto mt-3 max-w-lg text-center text-text-muted">
            Elegís tu rubro y Clozr arranca con el embudo de ventas listo. Lo
            ajustás en 2 minutos.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            {RUBROS.map((r) => (
              <span
                key={r.label}
                className="inline-flex items-center gap-2 rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-muted"
              >
                <span className="text-base">{r.emoji}</span> {r.label}
              </span>
            ))}
            <span className="inline-flex items-center rounded-full border border-border bg-surface px-4 py-2 text-sm font-medium text-text-dim">
              y más…
            </span>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Precio simple, sin sorpresas
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-text-muted">
          Empezá gratis. Pagás recién cuando sumás a tu equipo.
        </p>
        <div className="mt-12 grid gap-6 md:grid-cols-3">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border p-7 ${
                p.highlight
                  ? "border-primary bg-surface shadow-[0_0_40px_rgba(225,29,72,0.15)]"
                  : "border-border bg-surface"
              }`}
            >
              {p.highlight && (
                <span className="absolute -top-3 left-7 rounded-full bg-primary px-3 py-1 text-xs font-bold text-white">
                  Más elegido
                </span>
              )}
              <h3 className="text-lg font-bold">{p.name}</h3>
              <div className="mt-3 flex items-baseline gap-1.5">
                <span className="text-3xl font-extrabold tracking-tight">{p.price}</span>
                {p.tag && <span className="text-sm text-text-dim">{p.tag}</span>}
              </div>
              <ul className="mt-6 space-y-3 text-sm">
                {p.perks.map((perk) => (
                  <li key={perk} className="flex items-center gap-2.5 text-text-muted">
                    <span className="text-success">✓</span> {perk}
                  </li>
                ))}
              </ul>
              <Link
                href="/app"
                className={`mt-7 block rounded-lg py-2.5 text-center text-sm font-semibold transition ${
                  p.highlight
                    ? "bg-primary text-white hover:bg-primary-hover"
                    : "bg-surface-2 text-text hover:bg-border-strong"
                }`}
              >
                {p.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mx-auto mt-8 max-w-2xl text-center text-sm text-text-dim">
          + US$ 5 por empleado extra · + US$ 10 por sucursal · 2 meses gratis
          pagando al año · 14 días de prueba.
          <br />
          Precios en dólares — los pagás en pesos con Mercado Pago, al cambio del día.
        </p>
      </section>

      {/* CTA final */}
      <section className="mx-auto my-10 w-full max-w-6xl px-6">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-surface to-bg p-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Tu próxima venta empieza acá</h2>
          <p className="mx-auto mt-3 max-w-md text-text-muted">
            Sumate a los negocios que ya dejaron las planillas atrás.
          </p>
          <Link
            href="/app"
            className="mt-8 inline-block rounded-lg bg-primary px-8 py-3 font-semibold text-white transition hover:bg-primary-hover"
          >
            Crear cuenta gratis
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="mt-auto border-t border-border">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-8 text-sm text-text-dim sm:flex-row">
          <Logo />
          <span>© 2026 Clozr. Hecho en LATAM.</span>
        </div>
      </footer>
    </div>
  );
}
