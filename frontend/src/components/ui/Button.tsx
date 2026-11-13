import { ButtonHTMLAttributes, forwardRef } from "react";

type Variant = "primary" | "secondary" | "danger" | "ghost";

// Boutons monochromes (noir sur clair, blanc sur sombre) : la couleur reste réservée aux alertes.
const VARIANTS: Record<Variant, string> = {
  primary: "bg-zinc-100 text-zinc-950 hover:bg-zinc-300",
  secondary: "bg-zinc-900 text-zinc-100 ring-1 ring-inset ring-zinc-700 hover:bg-zinc-800",
  danger: "bg-rose-600 text-pure-white hover:bg-rose-500",
  ghost: "text-zinc-400 hover:bg-zinc-800 hover:text-zinc-100",
};

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
}

export const Button = forwardRef<HTMLButtonElement, Props>(({ variant = "primary", className = "", ...rest }, ref) => (
  <button
    ref={ref}
    className={`inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-1.5 text-[13px] font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${className}`}
    {...rest}
  />
));
Button.displayName = "Button";
