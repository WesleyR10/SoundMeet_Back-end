#!/usr/bin/env node
/**
 * Gate de auditoria das dependências de RUNTIME (SM-019).
 *
 *   node scripts/audit-gate.mjs
 *
 * Por que não `npm audit --audit-level=high` direto no CI: `npm audit` não tem
 * allowlist. Sem ela, um único aviso sem correção não-quebrante (hoje o
 * deepmerge-ts que chega pelo Prisma) deixa o gate vermelho para sempre — e
 * gate cronicamente vermelho treina todo mundo a ignorar CI vermelho, que é
 * pior do que não ter gate.
 *
 * Três condições de falha, não uma:
 *   1. aviso high/critical fora da allowlist        → precisa de decisão;
 *   2. exceção com `review_by` vencido              → decisão tem prazo;
 *   3. exceção que não corresponde a nenhum aviso   → exceção obsoleta.
 *
 * A (3) é a que impede o apodrecimento silencioso: sem ela, a allowlist vira um
 * cemitério de linhas que ninguém confere e que passariam a cobrir avisos
 * futuros do mesmo id sem revisão nenhuma.
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const ALLOWLIST_PATH = join(HERE, 'npm-audit-allowlist.json');
const BLOCKING_SEVERITIES = new Set(['high', 'critical']);

function runAudit() {
  // `npm audit` sai com código != 0 quando há avisos — é o caso normal aqui, e
  // por isso o status é ignorado e só o stdout importa.
  const result = spawnSync('npm', ['audit', '--omit=dev', '--json'], {
    cwd: join(HERE, '..'),
    encoding: 'utf8',
    maxBuffer: 32 * 1024 * 1024,
  });

  if (!result.stdout) {
    throw new Error(
      `npm audit não produziu saída (${result.error?.message ?? result.stderr ?? 'sem stderr'}).`,
    );
  }
  return JSON.parse(result.stdout);
}

/**
 * Extrai os avisos RAIZ. Numa cadeia (prisma -> @prisma/config -> deepmerge-ts)
 * o npm repete a severidade em cada elo, mas só o elo de origem traz o objeto
 * com `url`; os intermediários trazem o nome do pai como string. Deduplicar por
 * id do aviso é o que evita pedir três exceções para um problema só.
 */
function collectAdvisories(report) {
  const advisories = new Map();

  for (const [pkg, vuln] of Object.entries(report.vulnerabilities ?? {})) {
    if (!BLOCKING_SEVERITIES.has(vuln.severity)) continue;

    for (const via of vuln.via ?? []) {
      if (typeof via !== 'object' || !via.url) continue;

      const id = via.url.split('/').pop();
      if (!advisories.has(id)) {
        advisories.set(id, { id, package: via.name ?? pkg, title: via.title, severity: via.severity });
      }
    }
  }

  return advisories;
}

function main() {
  const allowlist = JSON.parse(readFileSync(ALLOWLIST_PATH, 'utf8')).allow ?? [];
  const advisories = collectAdvisories(runAudit());
  const allowedIds = new Set(allowlist.map((entry) => entry.id));
  const failures = [];

  for (const advisory of advisories.values()) {
    if (allowedIds.has(advisory.id)) continue;
    failures.push(
      `[novo] ${advisory.id} (${advisory.severity}) em ${advisory.package}: ${advisory.title}\n` +
        `        Corrija (npm audit fix) ou registre a exceção com motivo e prazo em ` +
        `scripts/npm-audit-allowlist.json.`,
    );
  }

  // Comparação por DIA, não por instante: um prazo vence no fim do dia marcado.
  const today = new Date().toISOString().slice(0, 10);

  for (const entry of allowlist) {
    if (!entry.review_by || !entry.reason) {
      failures.push(`[inválida] ${entry.id}: exceção sem "reason" e/ou "review_by".`);
      continue;
    }
    if (entry.review_by < today) {
      failures.push(
        `[vencida] ${entry.id} (${entry.package}): prazo de revisão era ${entry.review_by}. ` +
          `Reavalie e renove com nova data, ou corrija a dependência.`,
      );
    }
    if (!advisories.has(entry.id)) {
      failures.push(
        `[obsoleta] ${entry.id} (${entry.package}): não aparece mais na auditoria. ` +
          `Remova a entrada — exceção que não cobre nada só esconde o próximo aviso de mesmo id.`,
      );
    }
  }

  if (failures.length > 0) {
    console.error(`\nGate de auditoria REPROVADO (${failures.length}):\n`);
    for (const failure of failures) console.error(`  - ${failure}\n`);
    process.exit(1);
  }

  const covered = allowlist.map((entry) => `${entry.id} até ${entry.review_by}`).join(', ');
  console.log(
    `Gate de auditoria OK — nenhum aviso high/critical fora da allowlist` +
      (covered ? `.\nExceções ativas: ${covered}.` : '.'),
  );
}

main();
