import type { MetadataRoute } from "next";

// Carte d'identité de l'application pour le navigateur : c'est elle qui
// rend « Partant ? » installable sur l'écran d'accueil du téléphone.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Partants ?",
    short_name: "Partants ?",
    description:
      "Organise des sorties entre potes, sans noyer les groupes de discussion.",
    lang: "fr",
    start_url: "/",
    display: "standalone",
    background_color: "#F1F6F4",
    theme_color: "#F1F6F4",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      {
        src: "/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
