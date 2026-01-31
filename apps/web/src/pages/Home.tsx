import { Link } from "react-router-dom";

const steps = [
  {
    title: "Reporta en segundos",
    description:
      "Describe la incidencia y agrega una ubicacion aproximada desde tu movil.",
  },
  {
    title: "Se valida y prioriza",
    description:
      "La comunidad y el municipio revisan el reporte para ordenar la atencion.",
  },
  {
    title: "Seguimiento transparente",
    description:
      "Consulta avances y comparte el estado con tus vecinos.",
  },
];

const categories = [
  { name: "Baches", detail: "Calles seguras y transitables." },
  { name: "Luminarias", detail: "Iluminacion nocturna confiable." },
  { name: "Veredas", detail: "Accesos peatonales sin barreras." },
  { name: "Drenaje", detail: "Prevencion de anegamientos." },
];

const Home = () => {
  return (
    <div className="flex flex-col gap-16">
      <section className="grid items-center gap-12 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-[var(--ct-border)] bg-white/70 px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
            Plataforma publica de incidencias
          </div>
          <h1 className="text-4xl font-[var(--ct-font-display)] leading-tight text-[var(--ct-ink)] sm:text-5xl lg:text-6xl">
            CivicTrack hace visible lo que tu barrio necesita.
          </h1>
          <p className="text-lg text-[var(--ct-ink-muted)] sm:text-xl">
            Registra baches, luminarias y otros problemas urbanos para que la
            comunidad y las autoridades actuen con datos claros.
          </p>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Link
              to="/map"
              className="inline-flex items-center justify-center rounded-full bg-[var(--ct-accent)] px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-[var(--ct-accent-strong)]"
            >
              Ver mapa
            </Link>
            <Link
              to="/map"
              className="inline-flex items-center justify-center rounded-full border border-[var(--ct-border)] bg-white/80 px-6 py-3 text-sm font-semibold text-[var(--ct-ink)] transition hover:border-[var(--ct-accent)] hover:text-[var(--ct-accent-strong)]"
            >
              Reportar incidencia
            </Link>
          </div>
          <div className="flex flex-wrap gap-4 text-sm text-[var(--ct-ink-muted)]">
            <span className="rounded-full border border-[var(--ct-border)] bg-white/70 px-3 py-1">
              Datos abiertos
            </span>
            <span className="rounded-full border border-[var(--ct-border)] bg-white/70 px-3 py-1">
              Comunidad activa
            </span>
            <span className="rounded-full border border-[var(--ct-border)] bg-white/70 px-3 py-1">
              Respuesta rapida
            </span>
          </div>
        </div>
        <div className="rounded-[2rem] border border-[var(--ct-border)] bg-white/80 p-8 shadow-[0_20px_60px_-40px_rgba(0,0,0,0.4)]">
          <div className="space-y-6">
            <div className="rounded-2xl border border-[var(--ct-border)] bg-[var(--ct-accent-soft)] p-6">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ct-accent-strong)]">
                Mapa en tiempo real
              </p>
              <h2 className="mt-3 text-2xl font-[var(--ct-font-display)]">
                Un tablero unico para ver y priorizar incidencias.
              </h2>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="rounded-2xl border border-[var(--ct-border)] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Incidencias activas
                </p>
                <p className="mt-3 text-3xl font-semibold text-[var(--ct-accent-strong)]">
                  128
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--ct-border)] bg-white p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Barrios conectados
                </p>
                <p className="mt-3 text-3xl font-semibold text-[var(--ct-accent-strong)]">
                  24
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--ct-border)] bg-white p-4 sm:col-span-2">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
                  Ultima actualizacion
                </p>
                <p className="mt-2 text-lg font-semibold text-[var(--ct-ink)]">
                  Hace 6 minutos en el centro
                </p>
              </div>
            </div>
            <p className="text-sm text-[var(--ct-ink-muted)]">
              Proximamente: reportes con evidencia visual y notificaciones
              proactivas.
            </p>
          </div>
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex items-center justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
              Como funciona
            </p>
            <h2 className="mt-2 text-3xl font-[var(--ct-font-display)]">
              Un flujo claro para transformar reportes en soluciones.
            </h2>
          </div>
          <div className="hidden rounded-full border border-[var(--ct-border)] bg-white/80 px-5 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)] lg:block">
            3 pasos simples
          </div>
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          {steps.map((step, index) => (
            <div
              key={step.title}
              className="rounded-3xl border border-[var(--ct-border)] bg-white/85 p-6 shadow-[0_18px_50px_-40px_rgba(0,0,0,0.5)]"
            >
              <p className="text-sm font-semibold text-[var(--ct-accent-strong)]">
                {String(index + 1).padStart(2, "0")}
              </p>
              <h3 className="mt-3 text-xl font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm text-[var(--ct-ink-muted)]">
                {step.description}
              </p>
            </div>
          ))}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
              Categorias clave
            </p>
            <h2 className="mt-2 text-3xl font-[var(--ct-font-display)]">
              Reporta lo que impacta tu dia a dia.
            </h2>
          </div>
          <Link
            to="/map"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[var(--ct-accent-strong)]"
          >
            Explorar mapa
            <span aria-hidden>→</span>
          </Link>
        </div>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {categories.map((category) => (
            <div
              key={category.name}
              className="rounded-3xl border border-[var(--ct-border)] bg-white/80 p-6 transition hover:-translate-y-1 hover:border-[var(--ct-accent)] hover:shadow-[0_25px_60px_-35px_rgba(0,0,0,0.45)]"
            >
              <h3 className="text-xl font-semibold">{category.name}</h3>
              <p className="mt-2 text-sm text-[var(--ct-ink-muted)]">
                {category.detail}
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
};

export default Home;
