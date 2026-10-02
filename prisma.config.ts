// Tells Prisma how to create the practice users.
// The database location stays in .env. We load that file here because Prisma
// does not load it on its own once this config file exists.

import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    seed: "tsx prisma/seed.ts",
  },
});
