const MapPublic = () => {
  return (
    <div className="flex flex-col gap-8">
      <header className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)]">
          Mapa publico
        </p>
        <h1 className="text-3xl font-[var(--ct-font-display)] sm:text-4xl">
          Incidencias visibles para toda la ciudad.
        </h1>
        <p className="max-w-2xl text-sm text-[var(--ct-ink-muted)] sm:text-base">
          Aqui veremos el mapa con filtros, capas y reportes. Por ahora es un
          placeholder para la primera entrega.
        </p>
      </header>
      <section className="rounded-[2rem] border border-[var(--ct-border)] bg-white/80 p-6 shadow-[0_20px_60px_-45px_rgba(0,0,0,0.45)]">
        <div className="flex h-[360px] items-center justify-center rounded-3xl border border-dashed border-[var(--ct-border)] bg-[var(--ct-accent-soft)]/40 text-sm font-semibold uppercase tracking-[0.2em] text-[var(--ct-accent-strong)]">
          Area de mapa en construccion
        </div>
      </section>
    </div>
  );
};

export default MapPublic;
