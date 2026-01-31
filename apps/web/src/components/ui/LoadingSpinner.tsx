const LoadingSpinner = ({ label = "Cargando..." }: { label?: string }) => {
  return (
    <div className="flex items-center gap-3 text-sm text-[var(--ct-ink-muted)]">
      <span className="relative inline-flex h-4 w-4">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--ct-accent)]/30" />
        <span className="relative inline-flex h-4 w-4 rounded-full bg-[var(--ct-accent)]" />
      </span>
      <span>{label}</span>
    </div>
  );
};

export default LoadingSpinner;
