import {
  ContractCertificateRenderInput,
  ContractRenderInput,
} from "../../../application/ports/contract-renderer.port";
import { ClauseCatalog } from "../../../domain/catalog/clause-catalog";
import { SHOW_CONTRACT_V1 } from "../../../domain/catalog/templates/show-contract-v1";
import { ContractFakeBuilder } from "../../../domain/contract-fake.builder";
import { ContractSignature } from "../../../domain/value-objects/contract-signature.vo";
import { STAGE_SPEC_LABELS } from "../contract-pdf.document";
import { ReactPdfContractRenderer } from "../react-pdf-contract.renderer";

/**
 * 🔴 Paridade do Anexo I entre PDF e painel web.
 *
 * `soundmeet-web/src/features/contract/domain/stage-spec-rows.ts` renderiza o
 * mesmo anexo, do mesmo snapshot congelado, para quem lê e assina o contrato
 * pelo painel. Divergir em rótulo ou ordem significa que as duas partes viram
 * documentos diferentes — e a cláusula `estrutura_tecnica.com_anexo` faz de
 * "item declarado no Anexo I" um inadimplemento.
 *
 * O espelho existe porque são runtimes diferentes e projetos separados; este
 * teste (e o gêmeo no web) é o que transforma a divergência em falha de CI.
 */
describe("Anexo I — paridade de rótulos com o painel web", () => {
  it("mantém rótulos e ordem", () => {
    expect(STAGE_SPEC_LABELS.map((field) => field.label)).toEqual([
      "Sistema de PA",
      "Canais na mesa",
      "Retornos de palco",
      "Microfones",
      "Backline",
      "Dimensões do palco",
      "Energia",
      "Operador de som",
      "Estacionamento",
      "Janela de passagem de som",
      "Observações",
    ]);
  });
});

/**
 * Renderiza um PDF de verdade.
 *
 * `@react-pdf/renderer` é a única dependência nova desta fatia e o risco
 * declarado era interoperabilidade com `module: "commonjs"` — que só um render
 * real exercita. Um mock aqui não provaria nada.
 */
describe("ReactPdfContractRenderer", () => {
  const renderer = new ReactPdfContractRenderer();
  const catalog = new ClauseCatalog();

  function renderInput(
    overrides: Partial<ContractRenderInput> = {},
    // O contexto entra por parâmetro porque o Anexo I deixou de ser um campo
    // solto da porta e passou a viver em `variables`, derivado de
    // `has_stage_tech_spec` — a mesma condição que escolhe a variante da
    // cláusula de estrutura. Testar "sem ficha" é trocar o contexto, não
    // sobrescrever um campo.
    context = ContractFakeBuilder.defaultContext(),
  ): ContractRenderInput {
    const variables = ContractFakeBuilder.variablesFor(context);
    const contractor = ContractFakeBuilder.defaultContractor();
    const contracted = ContractFakeBuilder.defaultContracted();

    return {
      template_version: SHOW_CONTRACT_V1.version,
      template_title: SHOW_CONTRACT_V1.title,
      contractor: contractor.toJSON(),
      contracted: contracted.toJSON(),
      variables: variables.toJSON(),
      clauses: catalog
        .render(SHOW_CONTRACT_V1, context, variables)
        .map((clause) => clause.toJSON()),
      content_hash: "a".repeat(64),
      verification_code: "ABC123XYZ",
      verification_url: "https://soundmeet.com.br/contrato/ABC123XYZ",
      issued_at: new Date("2026-08-15T12:00:00Z"),
      ...overrides,
    };
  }

  const timeout = 30_000;

  it(
    "gera um PDF válido do contrato",
    async () => {
      const rendered = await renderer.renderContract(renderInput());

      expect(rendered.content_type).toBe("application/pdf");
      expect(rendered.file_extension).toBe("pdf");
      // Assinatura de arquivo PDF — os 5 primeiros bytes são "%PDF-".
      expect(rendered.data.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(rendered.data.length).toBeGreaterThan(5_000);
    },
    timeout,
  );

  it(
    "gera o PDF sem a Ficha Técnica quando a casa não preencheu",
    async () => {
      const rendered = await renderer.renderContract(
        renderInput(
          {},
          {
            ...ContractFakeBuilder.defaultContext(),
            has_stage_tech_spec: false,
          },
        ),
      );

      expect(rendered.data.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    },
    timeout,
  );

  it(
    "gera o certificado de assinatura com a trilha das duas partes",
    async () => {
      const base = renderInput();
      const signatures = [
        new ContractSignature({
          role: "contractor",
          signer_name: "José da Silva",
          signer_document: "98765432100",
          signer_email: "contato@bardoze.com.br",
          signer_user_id: "9f0f0000-0000-4000-8000-000000000001",
          signed_at: new Date("2026-08-15T13:00:00Z"),
          method: "platform_acceptance",
          ip: "10.0.0.5",
          ip_source: "proxied",
          forwarded_for: "203.0.113.7, 10.0.0.5",
          user_agent: "Mozilla/5.0",
        }).toJSON(),
        new ContractSignature({
          role: "contracted",
          signer_name: "Ana Ribeiro",
          signer_document: "12345678901",
          signer_email: "ana@exemplo.com",
          signer_user_id: "9f0f0000-0000-4000-8000-000000000002",
          signed_at: new Date("2026-08-15T14:00:00Z"),
          method: "platform_acceptance",
          ip: "203.0.113.99",
          ip_source: "direct",
          forwarded_for: null,
          user_agent: "SoundMeet/1.0 (Android)",
        }).toJSON(),
      ];

      const input: ContractCertificateRenderInput = {
        ...base,
        signatures,
        signed_at: new Date("2026-08-15T14:00:00Z"),
      };

      const rendered = await renderer.renderSignatureCertificate(input);

      expect(rendered.data.subarray(0, 5).toString("latin1")).toBe("%PDF-");
      expect(rendered.data.length).toBeGreaterThan(3_000);
    },
    timeout,
  );

  /**
   * Acentuação é o modo clássico de um PDF sair errado. Helvetica embutida
   * cobre WinAnsi, que tem todo o português — mas isso só se prova rodando.
   */
  it(
    "aceita acentuação e cedilha sem quebrar a renderização",
    async () => {
      const base = renderInput();
      const rendered = await renderer.renderContract({
        ...base,
        contractor: {
          ...base.contractor,
          legal_name: "Bar Ação & Cia. Ltda. — Açaí, Ñ, ÊÃÇÕ",
        },
      });

      expect(rendered.data.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    },
    timeout,
  );
});
