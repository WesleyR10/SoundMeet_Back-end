/**
 * Backfill SM-016 — popula as colunas novas a partir das legadas em texto
 * puro, sem tocar nas colunas antigas (remoção fica para uma migration
 * separada, depois de validar em produção). Idempotente: só processa linhas
 * onde a coluna nova ainda está vazia, então rodar mais de uma vez não
 * duplica nem corrompe nada.
 *
 *   - musicians/establishments/audiences.email_token  -> email_token_hash (SHA-256)
 *   - tips.pixKey                                     -> pixKeyCiphertext/Iv/AuthTag (AES-256-GCM)
 *   - musician_wallets.pixKey                         -> pixKeyCiphertext/Iv/AuthTag
 *   - musician_wallets.bankAccount                    -> bankAccountCiphertext/Iv/AuthTag
 *
 * Uso:
 *   npm run backfill:sm016
 *
 * Precisa de TOKEN_ENCRYPTION_KEY real (a mesma usada pela app em produção)
 * — sem ela o script recusa rodar, pois um backfill cifrado com uma chave
 * diferente da que a app usa em runtime gera dado ilegível.
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { PrismaPg } from "@prisma/adapter-pg";
import { Prisma, PrismaClient } from "@prisma/client";

import { AesGcmEncryptionService } from "../src/core/shared/infra/crypto/aes-gcm-encryption.service";

function loadEnvValue(name: string): string | undefined {
  if (process.env[name]) return process.env[name];
  try {
    const env = readFileSync(resolve(__dirname, "../envs/.env"), "utf8");
    const line = env.split("\n").find((l) => l.startsWith(`${name}=`));
    return line ? line.slice(name.length + 1).trim() : undefined;
  } catch {
    return undefined;
  }
}

const DATABASE_URL = loadEnvValue("DATABASE_URL");
if (!DATABASE_URL) {
  throw new Error("DATABASE_URL não encontrada (env ou envs/.env)");
}

const TOKEN_ENCRYPTION_KEY = loadEnvValue("TOKEN_ENCRYPTION_KEY");
if (!TOKEN_ENCRYPTION_KEY) {
  console.error(
    "❌ TOKEN_ENCRYPTION_KEY ausente. Use a MESMA chave que a app usa em " +
      "runtime — cifrar o backfill com outra chave torna o dado ilegível " +
      "depois. Gere com: openssl rand -base64 32 (só se for a primeira vez " +
      "que a app inteira liga TOKEN_ENCRYPTION_KEY).",
  );
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: DATABASE_URL });
const prisma = new PrismaClient({ adapter });
const encryption = new AesGcmEncryptionService(TOKEN_ENCRYPTION_KEY);

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function backfillEmailTokenHash() {
  const models = [
    { name: "musician", client: prisma.musician },
    { name: "establishment", client: prisma.establishment },
    { name: "audience", client: prisma.audience },
  ] as const;

  for (const { name, client } of models) {
    const rows = await (client as any).findMany({
      where: { email_token: { not: null }, email_token_hash: null },
      select: { id: true, email_token: true },
    });

    for (const row of rows) {
      await (client as any).update({
        where: { id: row.id },
        data: { email_token_hash: hashToken(row.email_token) },
      });
    }

    console.log(`✅ ${name}: ${rows.length} email_token_hash preenchidos`);
  }
}

async function backfillTipPixKey() {
  const rows = await prisma.tip.findMany({
    where: { pixKey: { not: null }, pixKeyCiphertext: null },
    select: { id: true, pixKey: true },
  });

  for (const row of rows) {
    const encrypted = encryption.encrypt(row.pixKey!);
    await prisma.tip.update({
      where: { id: row.id },
      data: {
        pixKeyCiphertext: encrypted.ciphertext,
        pixKeyIv: encrypted.iv,
        pixKeyAuthTag: encrypted.authTag,
      },
    });
  }

  console.log(`✅ tips: ${rows.length} pixKey cifradas`);
}

async function backfillWalletPixKeyAndBankAccount() {
  const rows = await prisma.musicianWallet.findMany({
    where: {
      OR: [
        { pixKey: { not: null }, pixKeyCiphertext: null },
        { bankAccount: { not: Prisma.DbNull }, bankAccountCiphertext: null },
      ],
    },
    select: { id: true, pixKey: true, bankAccount: true },
  });

  let pixCount = 0;
  let bankCount = 0;

  for (const row of rows) {
    const data: Record<string, unknown> = {};

    if (row.pixKey) {
      const encrypted = encryption.encrypt(row.pixKey);
      data.pixKeyCiphertext = encrypted.ciphertext;
      data.pixKeyIv = encrypted.iv;
      data.pixKeyAuthTag = encrypted.authTag;
      pixCount++;
    }

    if (row.bankAccount !== null && row.bankAccount !== undefined) {
      const encrypted = encryption.encrypt(JSON.stringify(row.bankAccount));
      data.bankAccountCiphertext = encrypted.ciphertext;
      data.bankAccountIv = encrypted.iv;
      data.bankAccountAuthTag = encrypted.authTag;
      bankCount++;
    }

    if (Object.keys(data).length > 0) {
      await prisma.musicianWallet.update({ where: { id: row.id }, data });
    }
  }

  console.log(
    `✅ musician_wallets: ${pixCount} pixKey cifradas, ${bankCount} bankAccount cifrados`,
  );
}

async function main() {
  console.log("🔐 Backfill SM-016 — iniciando...");
  await backfillEmailTokenHash();
  await backfillTipPixKey();
  await backfillWalletPixKeyAndBankAccount();
  console.log("🎉 Backfill SM-016 concluído.");
}

main()
  .catch((error) => {
    console.error("❌ Backfill falhou:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
