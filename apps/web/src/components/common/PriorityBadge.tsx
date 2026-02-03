type PriorityLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | undefined | null;

const baseClasses =
  "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset";

const styles: Record<string, string> = {
  LOW: "bg-emerald-50 text-emerald-700 ring-emerald-200",
  MEDIUM: "bg-amber-50 text-amber-700 ring-amber-200",
  HIGH: "bg-orange-50 text-orange-700 ring-orange-200",
  CRITICAL: "bg-red-50 text-red-700 ring-red-200",
  NONE: "bg-slate-50 text-slate-700 ring-slate-200",
};

const labels: Record<string, string> = {
  LOW: "Baja",
  MEDIUM: "Media",
  HIGH: "Alta",
  CRITICAL: "Crítica",
  NONE: "Sin priorizar",
};

const PriorityBadge = ({ priority }: { priority?: PriorityLevel }) => {
  const key = priority ?? "NONE";
  const label = labels[key] ?? labels.NONE;
  const className = `${baseClasses} ${styles[key] ?? styles.NONE}`;

  return <span className={className}>{label}</span>;
};

export default PriorityBadge;
