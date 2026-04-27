export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full h-screen overflow-auto" style={{ background: "var(--color-bg, #0d0d0d)" }}>
      {children}
    </div>
  );
}
