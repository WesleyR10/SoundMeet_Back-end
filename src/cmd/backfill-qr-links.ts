/**
 * Reconcilia os QR codes gravados com o link https canônico derivado do id.
 *
 * ## Por que é um script, e não uma migration SQL
 *
 * O conteúdo do QR é derivado do id pelo DOMÍNIO (`buildMusicianQrLink`).
 * Reescrever a string em SQL duplicaria essa regra num lugar que ninguém
 * lembraria de atualizar — e o formato do link já mudou uma vez.
 *
 * ## O que este script NÃO faz
 *
 * 🔴 Não reimprime adesivo nenhum. Todo QR já impresso continua funcionando,
 * porque `ScanQRUseCase` aceita os dois formatos de propósito. Este backfill
 * serve para que QR **novo** — exibido no app, baixado, compartilhado — saia
 * no formato que funciona na câmera de quem não tem o app.
 *
 * Uso:
 *   npm run backfill:qr-links -- --dry-run
 *   npm run backfill:qr-links
 */
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";

import {
  buildEstablishmentQrLink,
  buildMusicianQrLink,
  QR_DEFAULT_BASE_URL,
} from "../core/shared/domain/value-objects/qr-code-link";

/**
 * 🔴 O critério é "difere do link canônico", NÃO "começa com `soundmeet://`".
 *
 * Até 07/set/2026 o filtro era o prefixo legado. Quando o host canônico mudou
 * de `soundmeet.app` (domínio de TERCEIRO, gravado por engano) para
 * `soundmeet.com.br`, as linhas que já haviam sido migradas para https ficaram
 * FORA do filtro — guardando um host que o próprio `ScanQRUseCase` passou a
 * recusar, ou seja, QR exibido no app e impossível de escanear. Reconciliar
 * contra o link derivado do id cobre o esquema legado, a troca de host e
 * qualquer mudança futura de formato, sem precisar prever qual foi.
 */
function selectStale<T extends { id: string; qr_code: string | null }>(
  rows: T[],
  buildLink: (id: string) => string,
): T[] {
  // `null` conta como desatualizado: a coluna é nullable no Prisma, e uma linha
  // sem QR é justamente uma que o backfill deve preencher.
  return rows.filter((row) => row.qr_code !== buildLink(row.id));
}

async function main() {
  const dryRun = process.argv.includes("--dry-run");
  const baseUrl = (process.env.APP_URL ?? QR_DEFAULT_BASE_URL).trim();

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL! }),
  });

  try {
    const musicians = selectStale(
      await prisma.musician.findMany({ select: { id: true, qr_code: true } }),
      (id) => buildMusicianQrLink(id, baseUrl),
    );

    const establishments = selectStale(
      await prisma.establishment.findMany({ select: { id: true, qr_code: true } }),
      (id) => buildEstablishmentQrLink(id, baseUrl),
    );

    console.log(
      JSON.stringify({
        event: "backfill.qr_links.scan",
        base_url: baseUrl,
        musicians: musicians.length,
        establishments: establishments.length,
        dry_run: dryRun,
      }),
    );

    if (dryRun) {
      for (const musician of musicians.slice(0, 5)) {
        console.log(
          `  ${musician.qr_code}  ->  ${buildMusicianQrLink(musician.id, baseUrl)}`,
        );
      }
      return;
    }

    /*
     * Um `update` por linha, e não `updateMany`: o link novo depende do id de
     * cada registro. Sequencial porque este é um script de manutenção pontual —
     * previsibilidade vale mais que velocidade.
     */
    for (const musician of musicians) {
      await prisma.musician.update({
        where: { id: musician.id },
        data: { qr_code: buildMusicianQrLink(musician.id, baseUrl) },
      });
    }

    for (const establishment of establishments) {
      await prisma.establishment.update({
        where: { id: establishment.id },
        data: { qr_code: buildEstablishmentQrLink(establishment.id, baseUrl) },
      });
    }

    console.log(
      JSON.stringify({
        event: "backfill.qr_links.done",
        musicians: musicians.length,
        establishments: establishments.length,
      }),
    );
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(
    JSON.stringify({
      event: "backfill.qr_links.failed",
      message: error instanceof Error ? error.message : String(error),
    }),
  );
  process.exit(1);
});
