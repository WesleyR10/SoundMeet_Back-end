import fs from "node:fs";
import path from "node:path";

import dotenv from "dotenv";
import { defineConfig } from "prisma/config";

const envsDir = path.resolve(process.cwd(), "envs");

const envFileCandidates = [
  process.env.DOTENV_CONFIG_PATH,
  path.join(envsDir, `.env.${process.env.NODE_ENV ?? "development"}`),
  path.join(envsDir, `.env`),
  path.join(process.cwd(), `.env.${process.env.NODE_ENV ?? "development"}`),
  path.join(process.cwd(), ".env.local"),
  path.join(process.cwd(), ".env"),
].filter((p): p is string => typeof p === "string" && p.length > 0);

for (const envFilePath of envFileCandidates) {
  if (!fs.existsSync(envFilePath)) continue;
  dotenv.config({ path: envFilePath });
  if (process.env.DATABASE_URL) break;
}

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    url: process.env.DATABASE_URL,
  },
})
