import ConditionalLayout from "@/components/layout/ConditionalLayout";

export default function SocialLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen overflow-hidden">
      <ConditionalLayout>{children}</ConditionalLayout>
    </div>
  );
}
