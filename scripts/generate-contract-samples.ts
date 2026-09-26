import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import { ContractContext } from "../src/core/contract/domain/catalog/clause.types";
import { ClauseCatalog } from "../src/core/contract/domain/catalog/clause-catalog";
import { SHOW_CONTRACT_V1 } from "../src/core/contract/domain/catalog/templates/show-contract-v1";
import { ContractFakeBuilder } from "../src/core/contract/domain/contract-fake.builder";
import { ContractParty } from "../src/core/contract/domain/value-objects/contract-party.vo";
import { ReactPdfContractRenderer } from "../src/core/contract/infra/renderer/react-pdf-contract.renderer";

/**
 * Gera as amostras do contrato em PDF — o "modelo do layout completo".
 *
 * ## Por que um script, e não um teste
 *
 * O `legal-checklist.md` promete ao advogado "três amostras do documento gerado"
 * e elas nunca existiram: não havia como produzi-las sem subir a aplicação
 * inteira e confirmar um booking real. Isso deixava a revisão jurídica
 * dependendo de um ambiente de pé, que é exatamente o atrito que faz o gate
 * ficar aberto.
 *
 * O documento é função pura de `(contexto, variáveis)` — o catálogo nunca vê
 * agregado, o renderer nunca vê banco. Então dá para gerar a amostra fiel sem
 * Postgres, sem Keycloak e sem storage. As amostras saem do MESMO catálogo e do
 * MESMO renderer que a emissão real usa: se a redação mudar, a amostra muda
 * junto, e nenhuma cópia manual envelhece em silêncio.
 *
 * ⚠️ Os dados são fictícios (`ContractFakeBuilder`) e o rodapé de cada amostra
 * carrega hash e código de verificação de mentira, que não resolvem na página
 * pública. É amostra de layout e redação, nunca documento válido.
 *
 * Uso: `npm run contract:samples` → escreve em `tmp/contract-samples/`.
 */

const OUTPUT_DIR = join(__dirname, "..", "tmp", "contract-samples");

/** Ficha técnica de exemplo — vira o Anexo I do documento. */
const STAGE_TECH_SPEC = {
  hasPa: true,
  mixerChannels: 12,
  monitors: 4,
  hasMicrophones: 6,
  backline: ["bateria", "cubo de guitarra"],
  dimensions: { widthM: 5, depthM: 3, heightM: 2.5 },
  power: { outlets: 8, voltage: "110V/220V" },
  hasParking: true,
  hasSoundEngineer: true,
  soundcheckWindow: "18:00-19:00",
  notes: "Palco elevado 40 cm.",
};

/**
 * Banda qualifica pelo LÍDER, pessoa física — banda não tem personalidade
 * jurídica e quem responde precisa ser identificável. Mesma regra de
 * `IssueContractUseCase.buildContracted`.
 */
function bandLeaderParty(): ContractParty {
  const leader = ContractFakeBuilder.defaultContracted();

  return new ContractParty({
    ...leader.toJSON(),
    display_name: "Trio Maré",
    representative: {
      name: leader.legal_name,
      document: leader.document,
      title: "líder da banda",
    },
  });
}

type Sample = {
  file: string;
  label: string;
  context: Partial<ContractContext>;
};

/**
 * As amostras foram escolhidas para cobrir as decisões que mais mudam o texto,
 * e não para enumerar combinações: alvo (solo/banda), tom, custódia e MEI são
 * os eixos que trocam variante de cláusula. As 1728 combinações possíveis já
 * têm cobertura no `clause-catalog.spec.ts`; aqui o objetivo é leitura humana.
 */
const SAMPLES: Sample[] = [
  {
    file: "01-musico-solo-formal.pdf",
    label: "Músico solo · tom formal · pagamento direto (fluxo de hoje)",
    context: { target: "musician", tone: "formal", uses_escrow: false },
  },
  {
    file: "02-banda-formal.pdf",
    label: "Banda · tom formal · pagamento direto",
    context: { target: "band", tone: "formal", uses_escrow: false },
  },
  {
    file: "03-musico-solo-direto.pdf",
    label: "Músico solo · tom direto · pagamento direto",
    context: { target: "musician", tone: "direto", uses_escrow: false },
  },
  {
    file: "04-musico-solo-custodia.pdf",
    label: "Músico solo · tom formal · COM custódia (fluxo do escrow, F1.3a)",
    context: { target: "musician", tone: "formal", uses_escrow: true },
  },
  {
    file: "05-musico-mei-custodia.pdf",
    label: "Músico MEI (CNPJ) · tom formal · COM custódia",
    context: {
      target: "musician",
      tone: "formal",
      uses_escrow: true,
      contracted_is_company: true,
    },
  },
];

async function main(): Promise<void> {
  const catalog = new ClauseCatalog();
  const renderer = new ReactPdfContractRenderer();

  mkdirSync(OUTPUT_DIR, { recursive: true });

  for (const sample of SAMPLES) {
    const context: ContractContext = {
      ...ContractFakeBuilder.defaultContext(),
      ...sample.context,
    };
    const variables = ContractFakeBuilder.variablesFor(context);
    const contracted =
      context.target === "band"
        ? bandLeaderParty()
        : ContractFakeBuilder.defaultContracted();

    const clauses = catalog.render(SHOW_CONTRACT_V1, context, variables);

    const rendered = await renderer.renderContract({
      template_version: SHOW_CONTRACT_V1.version,
      template_title: SHOW_CONTRACT_V1.title,
      contractor: ContractFakeBuilder.defaultContractor().toJSON(),
      contracted: contracted.toJSON(),
      variables: variables.toJSON(),
      clauses: clauses.map((clause) => clause.toJSON()),
      stage_tech_spec: context.has_stage_tech_spec ? STAGE_TECH_SPEC : null,
      // Amostra: hash e código não resolvem na verificação pública, de propósito.
      content_hash: "0".repeat(64),
      verification_code: "AMOSTRA000",
      verification_url: "https://soundmeet.com.br/contrato/AMOSTRA000",
      issued_at: new Date("2026-08-15T12:00:00Z"),
    });

    writeFileSync(join(OUTPUT_DIR, sample.file), rendered.data);
    console.log(
      `✔ ${sample.file.padEnd(30)} ${clauses.length} cláusulas — ${sample.label}`,
    );
  }

  const total = SHOW_CONTRACT_V1.clauses.length;
  const obrigatorias = SHOW_CONTRACT_V1.clauses.filter(
    (clause) => clause.required,
  ).length;
  const variantes = SHOW_CONTRACT_V1.clauses.reduce(
    (sum, clause) => sum + clause.variants.length,
    0,
  );

  console.log(
    `\nCatálogo ${SHOW_CONTRACT_V1.version}: ${total} cláusulas ` +
      `(${obrigatorias} obrigatórias, ${total - obrigatorias} opcionais), ` +
      `${variantes} variantes.`,
  );
  console.log(`Amostras em ${OUTPUT_DIR}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
