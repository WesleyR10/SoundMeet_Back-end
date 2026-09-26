// Precisa vir antes de qualquer módulo com decorator: os specs importam
// use-cases/inputs (com @Type() do class-transformer) direto, e esses
// decorators chamam Reflect.getMetadata na avaliação do módulo — antes de
// @nestjs/core entrar e carregar o polyfill por conta própria.
// Mesmo padrão do setup dos testes unitários (core/shared/infra/testing/expect-helpers.ts).
import "reflect-metadata";

import { config as dotenvConfig } from "dotenv";
import { join } from "path";

process.env.NODE_ENV = "test";
process.env.DOTENV_CONFIG_PATH ??= join(process.cwd(), "envs", ".env.e2e");

dotenvConfig({ path: process.env.DOTENV_CONFIG_PATH });
