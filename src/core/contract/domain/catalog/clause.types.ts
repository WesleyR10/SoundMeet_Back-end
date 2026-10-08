import {
  ContractVariableKey,
  ContractVariables,
} from "../value-objects/contract-variables.vo";

/**
 * O catálogo de cláusulas é **código**, não linha de banco.
 *
 * ## Por quê
 *
 * Quem edita texto de cláusula não é o estabelecimento nem o músico — é a
 * SoundMeet, com advogado. Texto jurídico precisa de revisão antes de ir a
 * produção e precisa viajar **atomicamente com o código que resolve suas
 * variáveis**. Se as cláusulas virassem linhas de banco, três coisas ruins
 * aconteceriam: nasceria um CRUD administrativo que ninguém usa; toda correção
 * de redação viraria migration; e passaria a ser possível alterar texto legal em
 * produção sem revisão — que é exatamente o que a regra "versão imutável, nunca
 * edição in-place" queria impedir.
 *
 * Com o catálogo em código: revisão jurídica é code review, o diff do PR mostra
 * a mudança exata de redação, e o teste de snapshot impede alteração silenciosa.
 *
 * A imutabilidade do contrato **emitido** continua garantida onde importa: o
 * agregado guarda o snapshot das cláusulas já renderizadas. O catálogo só é
 * consultado para CONSTRUIR um contrato novo — um contrato de 2026 renderiza
 * igual daqui a cinco anos porque não depende mais daqui.
 *
 * Trade-off assumido: mudar redação exige deploy. Para conteúdo jurídico isso é
 * vantagem, não custo.
 */

export const CLAUSE_CATEGORIES = [
  "objeto",
  "prazo",
  "preco",
  "estrutura",
  "obrigacoes",
  "cancelamento",
  "responsabilidade",
  "direitos",
  "gerais",
] as const;
export type ClauseCategory = (typeof CLAUSE_CATEGORIES)[number];

/**
 * O tom da redação — a "variedade" de uma mesma cláusula.
 *
 * Não é enfeite: um contrato de R$ 300 num bar de bairro e um de R$ 5.000 numa
 * casa de show não devem soar igual, e o artista que escolhe o tom rigoroso está
 * fazendo uma escolha de negócio, não de estilo.
 */
export const CLAUSE_TONES = ["formal", "direto", "rigoroso"] as const;
export type ClauseTone = (typeof CLAUSE_TONES)[number];

/** Tom usado quando o pedido não tem variante correspondente. */
export const DEFAULT_CLAUSE_TONE: ClauseTone = "formal";

/**
 * O contexto de um contrato — o que decide quais variantes se aplicam.
 *
 * Montado pela camada de aplicação a partir de `Booking`, `Establishment`,
 * `Musician`/`Band`. O catálogo nunca vê agregado.
 */
export type ContractContext = {
  target: "musician" | "band";
  /** Cachê em BRL. Decide faixas (camarim, tom padrão). */
  fee: number;
  /** A casa preencheu a Ficha Técnica do palco (A3/F1.2). */
  has_stage_tech_spec: boolean;
  /**
   * A Ficha Técnica declara janela de passagem de som.
   *
   * Fato próprio, e não derivável de `has_stage_tech_spec`: ficha preenchida
   * sem `soundcheckWindow` é caso comum (todo campo da ficha é opcional por
   * desenho). Sem esta distinção, a cláusula prometeria uma janela que não
   * existe.
   */
  has_soundcheck_window: boolean;
  /**
   * O pagamento passa pela custódia da plataforma.
   *
   * 🔑 É o único ponto de contato com o F1.3(a). Enquanto o escrow não existir
   * isto é sempre `false` e a variante de custódia simplesmente nunca é
   * escolhida — ligar o escrow depois não reescreve cláusula nenhuma.
   */
  uses_escrow: boolean;
  /** O evento é ao ar livre — muda a redação de caso fortuito. */
  outdoor: boolean;
  /** O artista pediu cláusula de exclusividade por raio. */
  exclusivity_requested: boolean;
  /** O contratante é pessoa jurídica — muda a cláusula de tributos. */
  contractor_is_company: boolean;
  /**
   * O CONTRATADO é pessoa jurídica — músico com CNPJ de MEI.
   *
   * 🔑 Não é simetria decorativa do campo acima: muda quem recolhe o quê.
   * A retenção previdenciária na fonte alcança o CONTRIBUINTE INDIVIDUAL
   * (art. 4º da Lei 10.666/2003). MEI é pessoa jurídica, não é contribuinte
   * individual nessa relação, e emite nota recolhendo pelo DAS — então mandar
   * o contratante reter INSS dele seria instruir uma retenção indevida num
   * documento que existe para ser seguido.
   */
  contracted_is_company: boolean;
  /** Tom preferido. Cai para `DEFAULT_CLAUSE_TONE` quando não houver variante. */
  tone: ClauseTone;
};

/**
 * Condições que tornam uma variante aplicável. Campo ausente = indiferente.
 *
 * Todas as condições declaradas precisam bater (E lógico). Uma variante sem
 * nenhuma condição é o catch-all da cláusula.
 */
export type ClauseApplicability = {
  target?: "musician" | "band";
  /** Inclusivo. */
  fee_min?: number;
  /** Exclusivo — evita sobreposição de faixas adjacentes. */
  fee_max?: number;
  has_stage_tech_spec?: boolean;
  has_soundcheck_window?: boolean;
  uses_escrow?: boolean;
  outdoor?: boolean;
  exclusivity_requested?: boolean;
  contractor_is_company?: boolean;
  contracted_is_company?: boolean;
};

export type ClauseVariant = {
  /** Único no catálogo inteiro. Convenção: `<clause_key>.<qualificador>.<tom>`. */
  readonly variant_id: string;
  readonly tone: ClauseTone;
  readonly applicability: ClauseApplicability;
  /**
   * As variáveis que este texto consome.
   *
   * É contrato explícito entre redação e dado: o teste do catálogo prova que
   * toda chave declarada existe em `ContractVariables` e que o corpo não usa
   * nada além disso. Sem essa declaração, renomear uma variável passaria pelo
   * compilador e só apareceria no PDF do cliente.
   */
  readonly consumes: readonly ContractVariableKey[];
  readonly title: string;
  readonly body: (v: ContractVariables) => string;
};

export type ClauseDefinition = {
  readonly key: string;
  readonly category: ClauseCategory;
  /**
   * Cláusula que todo contrato tem. Se nenhuma variante de uma cláusula
   * obrigatória se aplicar, a emissão **falha** — contrato com buraco não é
   * emitido, nunca degradado em silêncio.
   */
  readonly required: boolean;
  /**
   * Âncora legal e razão de existir. Vive no código e no
   * `Docs/_privado/juridico/checklist-juridico-do-contrato.md` — **nunca** é impressa no documento.
   * É o que torna a revisão com advogado objetiva.
   */
  readonly legal_note: string;
  readonly variants: readonly ClauseVariant[];
};

export type ContractTemplate = {
  /** Imutável. Redação nova = versão nova, nunca edição in-place. */
  readonly version: string;
  readonly title: string;
  /** Ordem das cláusulas no documento. */
  readonly clauses: readonly ClauseDefinition[];
};
