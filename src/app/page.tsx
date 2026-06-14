import Link from "next/link";

function Logo() {
  return (
    <div className="flex items-center gap-2.5">
      <div className="grid h-9 w-9 -skew-x-6 place-items-center rounded-lg bg-primary text-lg font-extrabold tracking-tighter text-white">
        CZ
      </div>
      <span className="text-lg font-bold tracking-tight">Clozr</span>
    </div>
  );
}

const FEATURES = [
  {
    title: "Pipeline visual",
    desc: "Arrastrá cada oportunidad por tus etapas. Ves de un vistazo qué está por cerrar y qué se está enfriando.",
    icon: "▦",
  },
  {
    title: "Tus contactos, ordenados",
    desc: "Toda tu cartera en un lugar: historial, notas y próximos pasos. Sin planillas perdidas.",
    icon: "☰",
  },
  {
    title: "Ventas y cobranzas",
    desc: "Registrá ventas, pagos y saldos pendientes. Sabé quién te debe y cuánto, al instante.",
    icon: "◧",
  },
  {
    title: "En equipo",
    desc: "Sumá a tu equipo con roles y permisos. Cada vendedor ve lo suyo, vos ves todo.",
    icon: "⚇",
  },
];

const PLANS = [
  {
    name: "Free",
    price: "$0",
    tag: "Para empezar",
    perks: ["1 usuario", "50 contactos", "Pipeline completo"],
    cta: "Crear cuenta",
    highlight: false,
  },
  {
    name: "Pro",
    price: "US$ 12",
    tag: "por usuario / mes",
    perks: ["Contactos ilimitados", "Ventas y cobranzas", "Reportes", "Soporte prioritario"],
    cta: "Probar 14 días",
    highlight: true,
  },
  {
    name: "Team",
    price: "Hablemos",
    tag: "Equipos grandes",
    perks: ["Todo lo de Pro", "Roles avanzados", "Onboarding dedicado"],
    cta: "Contactanos",
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
            Hecho para equipos de venta de LATAM 🌎
          </span>
          <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight md:text-6xl">
            Dejá el Excel.
            <br />
            <span className="text-primary-hover">Cerrá más ventas.</span>
          </h1>
          <p className="mx-auto mt-6 max-w-xl text-lg text-text-muted">
            Clozr es el CRM simple para seguir tus contactos, oportunidades y
            ventas sin complicarte. En español y al precio de tu mercado.
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
          Todo lo que tu equipo necesita
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-text-muted">
          Sin las 200 funciones que nunca vas a usar. Solo lo que mueve la aguja.
        </p>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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

      {/* Pricing */}
      <section id="pricing" className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-center text-3xl font-bold tracking-tight">
          Precio simple, sin sorpresas
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-center text-text-muted">
          Empezá gratis. Crecé cuando tu equipo crezca.
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
                <span className="text-sm text-text-dim">{p.tag}</span>
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
      </section>

      {/* CTA final */}
      <section className="mx-auto my-10 w-full max-w-6xl px-6">
        <div className="rounded-3xl border border-border bg-gradient-to-br from-surface to-bg p-12 text-center">
          <h2 className="text-3xl font-bold tracking-tight">Tu próxima venta empieza acá</h2>
          <p className="mx-auto mt-3 max-w-md text-text-muted">
            Sumate a los equipos que ya dejaron las planillas atrás.
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
