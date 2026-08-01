import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "GID — Gestión Integral Doméstica",
    short_name: "GID",
    description:
      "Organiza viviendas, documentos y vencimientos familiares en un solo lugar.",
    start_url: "/app",
    display: "standalone",
    background_color: "#f8fafc",
    theme_color: "#f8fafc",
    orientation: "portrait-primary",
    categories: ["productivity", "utilities"],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
