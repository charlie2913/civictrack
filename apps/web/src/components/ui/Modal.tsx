import { useEffect } from "react";

type ModalProps = {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children?: React.ReactNode;
  primaryLabel?: string;
  secondaryLabel?: string;
  onPrimary?: () => void;
  onSecondary?: () => void;
  intent?: "neutral" | "warning" | "danger" | "info";
};

const Modal = ({
  open,
  title,
  description,
  onClose,
  children,
  primaryLabel = "Confirmar",
  secondaryLabel = "Cancelar",
  onPrimary,
  onSecondary,
  intent = "neutral",
}: ModalProps) => {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    };
    if (open) {
      document.addEventListener("keydown", handleKey);
    }
    return () => {
      document.removeEventListener("keydown", handleKey);
    };
  }, [open, onClose]);

  if (!open) return null;

  const intentStyles: Record<
    NonNullable<ModalProps["intent"]>,
    { badge: string; primary: string }
  > = {
    neutral: {
      badge: "bg-[var(--ct-accent-soft)] text-[var(--ct-ink-muted)]",
      primary: "bg-[var(--ct-accent)] hover:bg-[var(--ct-accent-strong)]",
    },
    warning: {
      badge: "bg-amber-100 text-amber-700",
      primary: "bg-amber-500 hover:bg-amber-600",
    },
    danger: {
      badge: "bg-red-100 text-red-700",
      primary: "bg-red-500 hover:bg-red-600",
    },
    info: {
      badge: "bg-blue-100 text-blue-700",
      primary: "bg-blue-500 hover:bg-blue-600",
    },
  };

  const styles = intentStyles[intent];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        className="absolute inset-0"
        onClick={onClose}
        aria-hidden="true"
      />
      <div className="relative w-full max-w-lg rounded-[2rem] border border-[var(--ct-border)] bg-white p-8 shadow-[0_30px_80px_-40px_rgba(0,0,0,0.6)]">
        <div className="space-y-3">
          <p
            className={`inline-flex w-fit rounded-full px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.2em] ${styles.badge}`}
          >
            Confirmacion
          </p>
          <h2 className="text-2xl font-[var(--ct-font-display)]">{title}</h2>
          {description && (
            <p className="text-sm text-[var(--ct-ink-muted)]">{description}</p>
          )}
        </div>
        {children && <div className="mt-5">{children}</div>}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-end">
          <button
            type="button"
            onClick={onSecondary ?? onClose}
            className="rounded-full border border-[var(--ct-border)] px-6 py-3 text-sm font-semibold text-[var(--ct-ink-muted)] transition hover:border-[var(--ct-accent)] hover:text-[var(--ct-accent-strong)]"
          >
            {secondaryLabel}
          </button>
          <button
            type="button"
            onClick={onPrimary}
            className={`rounded-full px-6 py-3 text-sm font-semibold text-white shadow-sm transition ${styles.primary}`}
          >
            {primaryLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Modal;
