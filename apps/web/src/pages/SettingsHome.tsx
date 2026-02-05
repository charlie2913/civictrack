import { Link } from "react-router-dom";

const cards = [
  {
    title: "Usuarios",
    description: "Gestiona cuentas municipales y roles.",
    href: "/admin/users",
  },
  {
    title: "Catalogos",
    description: "Configura categorias y etiquetas.",
    href: "/admin/catalogs",
  },
  {
    title: "Parametros",
    description: "Ajusta limites y reglas operativas.",
    href: "/admin/system",
  },
  {
    title: "Notificaciones",
    description: "Define eventos y alertas.",
    href: "/admin/notifications",
  },
] as const;

const SettingsHome = () => {
  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
          Configuracion
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Panel de ajustes.
        </h1>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cards.map((card) => (
          <Link
            key={card.title}
            to={card.href}
            className="rounded-2xl border border-[var(--ct-border)] bg-white/90 px-5 py-6 text-sm text-[var(--ct-ink-muted)] shadow-[0_18px_50px_-40px_rgba(0,0,0,0.45)] transition hover:-translate-y-0.5 hover:border-[var(--ct-accent)]"
          >
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
              {card.title}
            </p>
            <p className="mt-2 text-[var(--ct-ink)]">{card.description}</p>
            <span className="mt-4 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-accent-strong)]">
              Entrar
            </span>
          </Link>
        ))}
      </div>
    </div>
  );
};

export default SettingsHome;
