import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the database and spreadsheet libraries out of the browser bundle.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "exceljs"],
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  // The site is opened at http://127.0.0.1:4317. Next treats that as different
  // from "localhost" and would otherwise refuse to send the page's scripts.
  allowedDevOrigins: ["127.0.0.1"],
};

export default nextConfig;
