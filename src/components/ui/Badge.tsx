type Variant = "emerald" | "blue" | "amber" | "indigo" | "cyan" | "slate" | "gray";

const variantStyles: Record<Variant, string> = {
  emerald: "bg-emerald-100 text-emerald-800",
  blue: "bg-blue-100 text-blue-800",
  amber: "bg-amber-100 text-amber-800",
  indigo: "bg-indigo-100 text-indigo-800",
  cyan: "bg-cyan-100 text-cyan-800",
  slate: "bg-slate-100 text-slate-600",
  gray: "bg-gray-100 text-gray-700",
};

type Props = {
  children: React.ReactNode;
  variant?: Variant;
};

/** 小さなラベルバッジ */
export function Badge({ children, variant = "gray" }: Props) {
  return (
    <span
      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${variantStyles[variant]}`}
    >
      {children}
    </span>
  );
}
