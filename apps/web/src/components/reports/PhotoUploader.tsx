import { useRef } from "react";

type PreviewItem = {
  file: File;
  previewUrl: string;
};

type PhotoUploaderProps = {
  previews: PreviewItem[];
  onFilesSelected: (files: FileList | null) => void;
  onRemove: (file: File) => void;
};

const PhotoUploader = ({ previews, onFilesSelected, onRemove }: PhotoUploaderProps) => {
  const inputRef = useRef<HTMLInputElement | null>(null);

  const handlePick = () => {
    inputRef.current?.click();
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={handlePick}
          className="rounded-full border border-[var(--ct-border)] px-4 py-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)] transition hover:border-[var(--ct-accent)]"
        >
          Agregar fotos
        </button>
        <p className="text-xs text-[var(--ct-ink-muted)]">
          Maximo 5 fotos · 5MB c/u · JPG, PNG o WEBP
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(event) => onFilesSelected(event.target.files)}
      />

      {previews.length > 0 ? (
        <div className="grid gap-4 sm:grid-cols-2">
          {previews.map((item) => (
            <div
              key={`${item.file.name}-${item.file.size}`}
              className="overflow-hidden rounded-2xl border border-[var(--ct-border)] bg-white"
            >
              <img
                src={item.previewUrl}
                alt={item.file.name}
                className="h-48 w-full object-cover"
              />
              <div className="flex items-center justify-between gap-2 px-4 py-3 text-xs text-[var(--ct-ink-muted)]">
                <span className="truncate">{item.file.name}</span>
                <button
                  type="button"
                  onClick={() => onRemove(item.file)}
                  className="rounded-full border border-[var(--ct-border)] px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ct-ink-muted)] transition hover:border-red-300 hover:text-red-600"
                >
                  Quitar
                </button>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-[var(--ct-border)] bg-[var(--ct-accent-soft)]/40 px-6 py-8 text-center text-sm text-[var(--ct-ink-muted)]">
          Aun no agregaste evidencias. Puedes continuar sin fotos.
        </div>
      )}
    </div>
  );
};

export default PhotoUploader;
