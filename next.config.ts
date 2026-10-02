import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // /notice-<id> is the public link. /notice remains the query-string page.
  async rewrites() {
    return [
      {
        source: "/notice-:id",
        destination: "/n/:id",
      },
    ];
  },
  // Keep the database and spreadsheet libraries out of the browser bundle.
  serverExternalPackages: ["@prisma/client", "bcryptjs", "exceljs", "pdfkit"],
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
