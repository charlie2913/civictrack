const Footer = () => {
  return (
    <footer className="border-t border-[var(--ct-border)] bg-[var(--ct-card)]">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-8 text-sm text-[var(--ct-ink-muted)] lg:flex-row lg:items-center lg:justify-between lg:px-10">
        <div>
          <p className="font-semibold text-[var(--ct-ink)]">CivicTrack</p>
          <p>Registro publico y colaborativo de incidencias urbanas.</p>
        </div>
        <p>Construyendo barrios mas seguros y conectados.</p>
      </div>
    </footer>
  );
};

export default Footer;
