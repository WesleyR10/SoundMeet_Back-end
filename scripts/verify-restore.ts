/* eslint-disable no-console */
/**
 * OPS-1 — verificação automatizada do drill de restauração.
 *
 * Executa os critérios do §4.3 de `Docs/ops/backup-restore.md` contra o banco
 * apontado por `DATABASE_URL`. Sai com código 1 se qualquer um falhar.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE ISTO EXISTE, E POR QUE ELE VEM ANTES DO BACKUP EM SI
 * ════════════════════════════════════════════════════════════════════════════
 *
 * "Backup não testado não é backup" (§4). O doc já trazia oito critérios de
 * sucesso — mas como checklist em Markdown, conferido à mão às 3h da manhã por
 * alguém que acabou de perder o banco. É exatamente o cenário em que um item se
 * pula sem querer, e o pior deles falha em SILÊNCIO: um restore que não decifra
 * a carteira parece perfeito até alguém tentar sacar.
 *
 * 🔴 **Isto roda contra um banco RESTAURADO, não contra um backup.** Por isso
 * independe da rota de PITR (Postgres gerenciado × `pgBackRest`/`wal-g` no
 * compose) que o §3.1 deixa em aberto junto com a decisão de deploy. Seja qual
 * for a escolha, o que prova que ela funcionou é este script.
 *
 * Uso:
 *   DATABASE_URL=... TOKEN_ENCRYPTION_KEY=... npx tsx scripts/verify-restore.ts
 *
 * ⚠️ `TOKEN_ENCRYPTION_KEY` deve vir do COFRE, digitada/injetada na hora — não
 * de um `.env` guardado ao lado do dump. Se este passo for fácil demais, o §1.2
 * foi violado e o backup deixou de proteger o que devia.
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import { AesGcmEncryptionService } from "../src/core/shared/infra/crypto/aes-gcm-encryption.service";

type CheckResult = {
  name: string;
  ok: boolean;
  detail: string;
  /** Critério que, falhando, invalida o restore inteiro (não só degrada). */
  fatal: boolean;
};

// Prisma 7 exige driver adapter explícito — mesmo padrão de `prisma/seed.ts`.
const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error(
    "DATABASE_URL ausente. Aponte para o banco RESTAURADO, nunca para produção (§4).",
  );
  process.exit(1);
}
const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString }),
});
const results: CheckResult[] = [];

function record(name: string, ok: boolean, detail: string, fatal = true): void {
  results.push({ name, ok, detail, fatal });
}

/**
 * §4.2 — os dois índices parciais únicos que vivem SÓ no SQL das migrations,
 * fora do schema do Prisma.
 *
 * 🔴 A ausência deles não quebra nada visivelmente: só deixa de impedir dois
 * sets ao vivo simultâneos para o mesmo músico, e duas lideranças aceitas na
 * mesma banda. É o tipo de dano que só aparece semanas depois, como dado
 * inconsistente sem causa aparente.
 */
async function checkPartialIndexes(): Promise<void> {
  const expected = [
    "performances_one_live_per_event_musician",
    "band_members_one_accepted_leader",
  ];

  const rows = await prisma.$queryRaw<{ indexname: string }[]>`
    SELECT indexname FROM pg_indexes WHERE indexname = ANY(${expected})
  `;
  const found = rows.map((r) => r.indexname);
  const missing = expected.filter((name) => !found.includes(name));

  record(
    "§4.2 índices parciais únicos",
    missing.length === 0,
    missing.length === 0
      ? `os ${expected.length} índices existem`
      : `AUSENTES: ${missing.join(", ")} — remova o DROP INDEX da migration`,
  );
}

/**
 * 🔴 O critério que prova que a chave do §1.2 sobreviveu JUNTO com o dado.
 *
 * Sem ele o restore parece bom e não é: as colunas cifradas voltam, o app sobe,
 * e só quando alguém for sacar é que se descobre que `mpAccessToken` virou
 * ruído. É o único check que exige a chave, e é de propósito.
 */
async function checkFieldDecryption(): Promise<void> {
  const key = process.env.TOKEN_ENCRYPTION_KEY;
  if (!key) {
    record(
      "§4.3 decifra carteira",
      false,
      "TOKEN_ENCRYPTION_KEY ausente — sem ela o drill NÃO pode passar (§1.2)",
    );
    return;
  }

  const wallet = await prisma.musicianWallet.findFirst({
    where: { mpAccessTokenCiphertext: { not: null } },
    select: {
      musicianId: true,
      mpAccessTokenCiphertext: true,
      mpAccessTokenIv: true,
      mpAccessTokenAuthTag: true,
    },
  });

  if (!wallet?.mpAccessTokenCiphertext) {
    record(
      "§4.3 decifra carteira",
      false,
      "nenhuma carteira com token de Mercado Pago no ponto restaurado — " +
        "o critério não pôde ser exercido; restaure um ponto que tenha uma",
      // Não-fatal: é ausência de amostra, não prova de falha. Mas o drill não
      // pode ser declarado bem-sucedido sem exercer este caminho.
      false,
    );
    return;
  }

  try {
    const plaintext = new AesGcmEncryptionService(key).decrypt({
      ciphertext: wallet.mpAccessTokenCiphertext,
      iv: wallet.mpAccessTokenIv!,
      authTag: wallet.mpAccessTokenAuthTag!,
    });
    record(
      "§4.3 decifra carteira",
      plaintext.length > 0,
      `carteira ${wallet.musicianId} decifrou (${plaintext.length} chars)`,
    );
  } catch (error) {
    record(
      "§4.3 decifra carteira",
      false,
      `FALHOU ao decifrar: ${(error as Error).message} — a chave não é a do ponto restaurado`,
    );
  }
}

/**
 * §4.3 — `held_balance` somado bate com os escrows em `held`.
 *
 * Custódia inconsistente depois de restore é dinheiro retido sem contrapartida:
 * o músico vê saldo bloqueado que nenhum show explica, ou o contrário.
 */
async function checkEscrowConsistency(): Promise<void> {
  const [walletSum, escrowSum] = await Promise.all([
    prisma.musicianWallet.aggregate({ _sum: { heldBalance: true } }),
    prisma.bookingEscrow.aggregate({
      where: { status: "held" },
      _sum: { netAmount: true },
    }),
  ]);

  const held = Number(walletSum._sum.heldBalance ?? 0);
  const escrow = Number(escrowSum._sum.netAmount ?? 0);
  // Centavos: a comparação é de dinheiro, não de float (ver o VO `Money`).
  const diff = Math.round((held - escrow) * 100);

  record(
    "§4.3 custódia consistente",
    diff === 0,
    diff === 0
      ? `held_balance = escrows held = R$ ${held.toFixed(2)}`
      : `DIVERGE: held_balance R$ ${held.toFixed(2)} × escrows held R$ ${escrow.toFixed(2)}`,
  );
}

/** §4.3 — contagens do ponto restaurado, para conferir contra o esperado. */
async function reportCounts(): Promise<void> {
  const [bookings, contracts, escrows, musicians, performances] =
    await Promise.all([
      prisma.booking.count(),
      prisma.contract.count(),
      prisma.bookingEscrow.count(),
      prisma.musician.count(),
      prisma.performance.count(),
    ]);

  record(
    "§4.3 contagens",
    // Banco vazio é restore falhado, não "sem dados".
    bookings + contracts + musicians > 0,
    `bookings=${bookings} contracts=${contracts} escrows=${escrows} ` +
      `musicians=${musicians} performances=${performances}`,
  );
}

/**
 * §3.1 — "Dois bancos, dois backups, UM INSTANTE".
 *
 * Restaurar a aplicação em T e o Keycloak em T−2h produz usuário que existe num
 * e não no outro. Aqui verificamos o lado que este script alcança: todo músico
 * e todo público nasce com `id == sub` do Keycloak, então um id que não é UUID
 * denuncia agregado que não veio de identidade real.
 *
 * ⚠️ A conferência COMPLETA exige o banco do Keycloak e é o passo "login
 * funciona com um usuário real" do §4.3 — manual, porque depende do Keycloak
 * de pé.
 */
async function checkIdentityShape(): Promise<void> {
  const rows = await prisma.$queryRaw<{ total: bigint; malformed: bigint }[]>`
    SELECT
      COUNT(*)::bigint AS total,
      COUNT(*) FILTER (
        WHERE id !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
      )::bigint AS malformed
    FROM musicians
  `;
  const { total = 0n, malformed = 0n } = rows[0] ?? {};

  record(
    "§3.1 identidade coerente",
    malformed === 0n,
    malformed === 0n
      ? `${total} músicos com id em formato de sub do Keycloak`
      : `${malformed} de ${total} músicos com id fora do formato de UUID`,
  );
}

async function main(): Promise<void> {
  console.log("Drill de restauração — critérios do §4.3\n");

  await reportCounts();
  await checkPartialIndexes();
  await checkFieldDecryption();
  await checkEscrowConsistency();
  await checkIdentityShape();

  for (const { name, ok, detail, fatal } of results) {
    const mark = ok ? "PASS" : fatal ? "FAIL" : "WARN";
    console.log(`[${mark}] ${name}\n       ${detail}`);
  }

  const failed = results.filter((r) => !r.ok && r.fatal);
  const warned = results.filter((r) => !r.ok && !r.fatal);

  console.log(
    `\n${results.length - failed.length - warned.length} passou, ` +
      `${warned.length} aviso, ${failed.length} falhou`,
  );

  if (failed.length > 0 || warned.length > 0) {
    console.log(
      "\nDrill NÃO passou. Registre em §5 com a causa, abra a correção como " +
        "tarefa e repita em até 7 dias (§4.4) — drill falhado sem repetição " +
        "agendada é a mesma armadilha da cláusula que nunca é emitida.",
    );
  }

  // Aviso também derruba: o §4.3 exige TODOS os critérios, e "não pôde ser
  // exercido" não é o mesmo que "passou".
  process.exitCode = failed.length + warned.length > 0 ? 1 : 0;
}

main()
  .catch((error) => {
    console.error("Drill abortou:", error);
    process.exitCode = 1;
  })
  .finally(() => void prisma.$disconnect());
