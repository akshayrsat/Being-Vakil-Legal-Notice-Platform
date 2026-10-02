// Home-screen icons for the browser and for Add to Home Screen.
// The pictures are the purple pillar from the social logo.
// Public notices keep the letterhead. These icons do not use it.

import type { MetadataRoute } from "next";
import { BRAND_PURPLE, PRODUCT_NAME, PRODUCT_TAGLINE } from "@/lib/brand";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `Being Vakil ${PRODUCT_NAME}`,
    short_name: PRODUCT_NAME,
    description: PRODUCT_TAGLINE,
    start_url: "/",
    display: "standalone",
    background_color: "#ffffff",
    theme_color: BRAND_PURPLE,
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
      },
      {
        src: "/icons/icon-maskable-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: "/icons/icon-maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
