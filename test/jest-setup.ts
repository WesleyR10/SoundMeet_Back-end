import { config as dotenvConfig } from "dotenv";
import { join } from "path";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH ??= join(process.cwd(), "envs", ".env.e2e");

dotenvConfig({ path: process.env.DOTENV_CONFIG_PATH });
