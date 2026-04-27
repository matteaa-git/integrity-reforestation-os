interface CardProps {
  children: React.ReactNode;
  className?: string;
  padding?: boolean;
}

export default function Card({ children, className = "", padding = true }: CardProps) {
  return (
    <div className={`bg-surface rounded-xl border border-border shadow-sm ${padding ? "p-5" : ""} ${className}`}>
      {children}
    </div>
  );
}
