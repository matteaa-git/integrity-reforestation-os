import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Integrity Reforestation OS",
    short_name: "Integrity",
    description: "Field operations + production reporting for Integrity Reforestation crews.",
    start_url: "/admin",
    display: "standalone",
    background_color: "#0d0d0d",
    theme_color: "#0d0d0d",
    orientation: "any",
    icons: [
      // Reusing the existing logo. For sharper install icons later we can add
      // a dedicated 512×512 PNG and (optionally) a maskable variant.
      { src: "/integrity-logo.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/integrity-logo.png", sizes: "192x192", type: "image/png", purpose: "any" },
    ],
  };
}
