type ButtonVariant = "primary" | "secondary" | "danger" | "ghost";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-primary text-white hover:bg-primary-dark shadow-sm",
  secondary: "bg-white text-text-primary border border-border hover:bg-surface-secondary shadow-sm",
  danger: "bg-red-500 text-white hover:bg-red-600 shadow-sm",
  ghost: "text-text-secondary hover:text-text-primary hover:bg-surface-secondary",
};

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
}

export default function Button({ variant = "primary", size = "md", className = "", children, ...props }: ButtonProps) {
  const sizeClass = size === "sm" ? "px-3 py-1.5 text-xs" : "px-4 py-2 text-sm";
  return (
    <button
      className={`inline-flex items-center justify-center gap-1.5 rounded-lg font-medium transition-colors disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${sizeClass} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
