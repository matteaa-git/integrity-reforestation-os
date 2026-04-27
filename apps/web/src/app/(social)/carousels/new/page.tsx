import dynamic from "next/dynamic";

const CarouselEditorPage = dynamic(
  () => import("@/components/carousel-builder/CarouselEditorPage"),
  {
    ssr: false,
    loading: () => (
      <div style={{ background: "#0d0d1a", height: "100dvh", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <p style={{ color: "rgba(255,255,255,0.3)", fontSize: 14, fontFamily: "system-ui" }}>Loading editor…</p>
      </div>
    ),
  }
);

export default function CarouselPage() {
  return <CarouselEditorPage />;
}
