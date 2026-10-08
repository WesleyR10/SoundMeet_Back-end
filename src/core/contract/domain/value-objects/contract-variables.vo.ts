import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { ValueObject } from "../../../shared/domain/value-object";
import {
  StageTechSpec,
  StageTechSpecJSON,
} from "../../../shared/domain/value-objects/stage-tech-spec.vo";

/**
 * As variáveis resolvidas de um contrato — o **único** argumento que o corpo de
 * uma cláusula recebe.
 *
 * ## Por que uma bolsa plana, e não os agregados
 *
 * `body` é `(v: ContractVariables) => string`: função pura de um argumento
 * tipado. Isso vale três coisas que template com `{{chave}}` não dá:
 * o compilador pega variável renomeada, não existe classe de bug de escaping, e
 * cada variante declara em `consumes` exatamente o que usa — o que permite um
 * teste provar que texto e dados não divergiram.
 *
 * Essa garantia depende de o corpo **não** alcançar nada além daqui. Por isso as
 * partes aparecem também como strings formatadas (`contratante_nome`,
 * `contratado_documento`, …) em vez de o corpo receber os VOs `ContractParty`.
 * A duplicação de meia dúzia de strings é o preço de um contrato verificável
 * entre o texto jurídico e o dado — e as duas cópias congelam juntas, na mesma
 * emissão, então não podem divergir depois.
 *
 * Já `Contract.parties` guarda a qualificação **estruturada**, e é ela que serve
 * ao preâmbulo, ao certificado de assinatura e à cópia do nome/documento do
 * signatário. Papéis diferentes, não redundância acidental.
 *
 * Tudo aqui já chega formatado em pt-BR. Formatar é responsabilidade de
 * `contract-format.ts`; este VO só congela e valida.
 */

export type ContractVariablesProps = {
  // ── Partes ────────────────────────────────────────────────────────────────
  contratante_nome: string;
  contratante_documento: string;
  contratante_endereco: string;
  contratante_representante: string | null;
  contratado_nome: string;
  contratado_documento: string;
  contratado_endereco: string;
  contratado_representante: string | null;
  contratado_e_banda: boolean;
  /** Nomes dos integrantes aceitos. Vazio quando o contratado é solo. */
  contratado_integrantes: string[];

  // ── Apresentação ──────────────────────────────────────────────────────────
  /** Ex.: "12 de setembro de 2026". */
  data_show: string;
  /** Ex.: "sábado". */
  dia_semana: string;
  /** "HH:mm" no fuso do estabelecimento. */
  hora_inicio: string;
  hora_fim: string;
  /** Ex.: "2h30". */
  duracao_formatada: string;
  duracao_minutos: number;
  local_nome: string;
  local_endereco: string;
  /** Comarca do foro — cidade/UF do local do show. */
  comarca: string;
  /** Ex.: "America/Sao_Paulo". Sem isto, "21:00" é ambíguo. */
  fuso_horario: string;

  // ── Valores ───────────────────────────────────────────────────────────────
  cache_valor: number;
  /** Ex.: "R$ 1.500,00". */
  cache_formatado: string;
  /** Ex.: "mil e quinhentos reais". */
  cache_extenso: string;
  /** Ex.: "em até 2 (dois) dias úteis após a apresentação". */
  pagamento_prazo_texto: string;
  /**
   * Instituição de pagamento que mantém o valor em custódia até a liberação.
   *
   * Só existe quando o pagamento passa pelo fluxo de custódia, e vai **nomeada**
   * no documento de propósito: é o que torna verificável a afirmação de que o
   * dinheiro não fica com a plataforma. Uma cláusula que dissesse apenas
   * "instituição autorizada" pediria confiança em vez de dar prova.
   */
  custodiante_nome: string | null;

  // ── Cancelamento ──────────────────────────────────────────────────────────
  /** Vem de `Booking.free_cancellation_hours` — não é constante do catálogo. */
  cancelamento_janela_horas: number;
  cancelamento_multa_percentual: number;
  cancelamento_multa_formatada: string;

  // ── Estrutura ─────────────────────────────────────────────────────────────
  passagem_som_janela: string | null;
  /** Resumo de uma linha da Ficha Técnica; o detalhe vai no Anexo I. */
  ficha_tecnica_resumo: string | null;
  /**
   * Anexo I — a Ficha Técnica do Palco inteira, congelada.
   *
   * Nenhuma cláusula consome esta chave, e isso é proposital: o Anexo I é uma
   * **seção do documento**, não texto interpolado. Ela vive aqui, e não solta na
   * porta do renderer, por uma razão só — **é o que a faz entrar no
   * `content_hash`**. Até 16/ago/2026 o anexo era lido do perfil VIVO na hora de
   * renderizar e ficava fora do hash: o mesmo contrato reemitido depois de o bar
   * editar a ficha saía com Anexo I diferente e hash idêntico, enquanto a
   * cláusula `estrutura_tecnica.com_anexo` transforma "item declarado no Anexo I"
   * em inadimplemento. A única parte do documento fora da verificação de
   * integridade era justamente a que cria obrigação.
   *
   * 🔴 **AUSENTE quando não há ficha — nunca `null`.** É a invariante que
   * preserva o hash de todo contrato emitido antes desta chave existir:
   * `JSON.stringify` omite chave com valor `undefined` e **inclui** `null`, e o
   * mapper recalcula o hash na carga e recusa contrato divergente
   * (`contract-model.mapper.ts`). Um `null` aqui faria todos os contratos
   * antigos pararem de carregar com `LoadEntityError`. O construtor apaga a
   * chave quando o valor não é objeto, para que nem um chamador distraído
   * consiga quebrar isso.
   */
  ficha_tecnica_anexo?: StageTechSpecJSON;

  // ── Condições operacionais ────────────────────────────────────────────────
  tolerancia_atraso_minutos: number;
  hora_extra_valor_formatado: string;
  exclusividade_raio_km: number | null;
  exclusividade_dias: number | null;
  imagem_prazo_meses: number;

  // ── Documento ─────────────────────────────────────────────────────────────
  plataforma_nome: string;
  plataforma_documento: string;
  codigo_verificacao: string;
  url_verificacao: string;
  /** Ex.: "14 de agosto de 2026". */
  emitido_em: string;
};

export type ContractVariablesJSON = ContractVariablesProps;

/** Toda chave que o corpo de uma cláusula pode declarar em `consumes`. */
export type ContractVariableKey = keyof ContractVariablesJSON;

/**
 * Toda chave que entra no snapshot. É whitelist, não conveniência: sem ela um
 * `Object.assign` deixaria qualquer campo extra do input vazar para dentro do
 * documento congelado. A checagem `_ALL_KEYS_COVERED` logo abaixo transforma
 * "esqueci de incluir a chave nova" em erro de compilação, não em variável que
 * some silenciosamente do contrato.
 */
export const CONTRACT_VARIABLE_KEYS = [
  "contratante_nome",
  "contratante_documento",
  "contratante_endereco",
  "contratante_representante",
  "contratado_nome",
  "contratado_documento",
  "contratado_endereco",
  "contratado_representante",
  "contratado_e_banda",
  "contratado_integrantes",
  "data_show",
  "dia_semana",
  "hora_inicio",
  "hora_fim",
  "duracao_formatada",
  "duracao_minutos",
  "local_nome",
  "local_endereco",
  "comarca",
  "fuso_horario",
  "cache_valor",
  "cache_formatado",
  "cache_extenso",
  "pagamento_prazo_texto",
  "custodiante_nome",
  "cancelamento_janela_horas",
  "cancelamento_multa_percentual",
  "cancelamento_multa_formatada",
  "passagem_som_janela",
  "ficha_tecnica_resumo",
  "ficha_tecnica_anexo",
  "tolerancia_atraso_minutos",
  "hora_extra_valor_formatado",
  "exclusividade_raio_km",
  "exclusividade_dias",
  "imagem_prazo_meses",
  "plataforma_nome",
  "plataforma_documento",
  "codigo_verificacao",
  "url_verificacao",
  "emitido_em",
] as const satisfies readonly ContractVariableKey[];

/**
 * Falha na compilação se uma chave nova do tipo não entrar em
 * `CONTRACT_VARIABLE_KEYS`.
 * (Array vazio não serviria de guarda: `[]` é atribuível a qualquer `T[]`.)
 */
type _AssertNothingMissing<T extends never> = T;
export type _AllVariableKeysCovered = _AssertNothingMissing<
  Exclude<ContractVariableKey, (typeof CONTRACT_VARIABLE_KEYS)[number]>
>;

const REQUIRED_TEXT_KEYS = [
  "contratante_nome",
  "contratante_documento",
  "contratante_endereco",
  "contratado_nome",
  "contratado_documento",
  "contratado_endereco",
  "data_show",
  "dia_semana",
  "hora_inicio",
  "hora_fim",
  "duracao_formatada",
  "local_nome",
  "local_endereco",
  "comarca",
  "fuso_horario",
  "cache_formatado",
  "cache_extenso",
  "pagamento_prazo_texto",
  "cancelamento_multa_formatada",
  "hora_extra_valor_formatado",
  "plataforma_nome",
  "plataforma_documento",
  "codigo_verificacao",
  "url_verificacao",
  "emitido_em",
] as const satisfies readonly ContractVariableKey[];

/**
 * Tetos legais da cláusula de exclusividade territorial.
 *
 * Não são preferência de produto: são o que mantém a cláusula válida. Restrição
 * à liberdade profissional (CF art. 5º, XIII) exige limitação em tempo, espaço
 * e atividade — e "20 km por 15 dias" é uma restrição defensável para um show,
 * enquanto "100 km por 6 meses" é a que um juiz derruba junto com a boa-fé do
 * resto do contrato.
 */
export const MAX_EXCLUSIVIDADE_RAIO_KM = 20;
export const MAX_EXCLUSIVIDADE_DIAS = 15;

const REQUIRED_NUMBER_KEYS = [
  "duracao_minutos",
  "cache_valor",
  "cancelamento_janela_horas",
  "cancelamento_multa_percentual",
  "tolerancia_atraso_minutos",
  "imagem_prazo_meses",
] as const satisfies readonly ContractVariableKey[];

export class ContractVariables extends ValueObject {
  readonly contratante_nome: string;
  readonly contratante_documento: string;
  readonly contratante_endereco: string;
  readonly contratante_representante: string | null;
  readonly contratado_nome: string;
  readonly contratado_documento: string;
  readonly contratado_endereco: string;
  readonly contratado_representante: string | null;
  readonly contratado_e_banda: boolean;
  readonly contratado_integrantes: string[];
  readonly data_show: string;
  readonly dia_semana: string;
  readonly hora_inicio: string;
  readonly hora_fim: string;
  readonly duracao_formatada: string;
  readonly duracao_minutos: number;
  readonly local_nome: string;
  readonly local_endereco: string;
  readonly comarca: string;
  readonly fuso_horario: string;
  readonly cache_valor: number;
  readonly cache_formatado: string;
  readonly cache_extenso: string;
  readonly pagamento_prazo_texto: string;
  readonly custodiante_nome: string | null;
  readonly cancelamento_janela_horas: number;
  readonly cancelamento_multa_percentual: number;
  readonly cancelamento_multa_formatada: string;
  readonly passagem_som_janela: string | null;
  readonly ficha_tecnica_resumo: string | null;
  readonly ficha_tecnica_anexo?: StageTechSpecJSON;
  readonly tolerancia_atraso_minutos: number;
  readonly hora_extra_valor_formatado: string;
  readonly exclusividade_raio_km: number | null;
  readonly exclusividade_dias: number | null;
  readonly imagem_prazo_meses: number;
  readonly plataforma_nome: string;
  readonly plataforma_documento: string;
  readonly codigo_verificacao: string;
  readonly url_verificacao: string;
  readonly emitido_em: string;

  constructor(props: ContractVariablesProps) {
    super();

    const picked: Record<string, unknown> = {};
    for (const key of CONTRACT_VARIABLE_KEYS) {
      picked[key] = props[key];
    }
    picked.contratado_integrantes = Array.isArray(props.contratado_integrantes)
      ? props.contratado_integrantes
          .map((name) => (typeof name === "string" ? name.trim() : ""))
          .filter((name) => name.length > 0)
      : [];

    /*
     * 🔴 A invariante de compatibilidade do `content_hash`, em uma linha.
     *
     * `JSON.stringify` OMITE chave com valor `undefined` e INCLUI `null`. Como o
     * mapper recalcula o hash na carga e recusa contrato divergente, a chave
     * precisa desaparecer da serialização canônica quando não há anexo — senão
     * todo contrato emitido antes desta chave existir passaria a falhar com
     * `LoadEntityError`.
     *
     * `delete` (em vez de atribuir `undefined`) é deliberado: garante que a
     * propriedade não exista nem como chave própria, então nenhum `Object.keys`,
     * spread ou serializador futuro consiga reintroduzi-la como `null`.
     * `null`, `undefined` e qualquer não-objeto caem todos aqui.
     */
    if (
      typeof picked.ficha_tecnica_anexo !== "object" ||
      picked.ficha_tecnica_anexo === null ||
      Array.isArray(picked.ficha_tecnica_anexo)
    ) {
      delete picked.ficha_tecnica_anexo;
    } else {
      /*
       * 🔴 A outra metade da mesma invariante: a ORDEM das chaves.
       *
       * A coluna é `jsonb`, que devolve as chaves de objeto reordenadas (por
       * tamanho, depois byte a byte). Guardado verbatim, o anexo voltava do
       * banco em outra ordem, o `JSON.stringify` do hash mudava e todo contrato
       * de casa com ficha técnica falhava na carga com `LoadEntityError`.
       * Passar pelo `StageTechSpec` devolve sempre a ordem do `toJSON()` — a
       * mesma com que a emissão calcula o hash, então nenhum hash já gravado
       * muda.
       */
      picked.ficha_tecnica_anexo = StageTechSpec.fromJSON(
        picked.ficha_tecnica_anexo,
      ).toJSON();
    }

    Object.assign(this, picked);

    this.validate();
  }

  /**
   * Serialização canônica: a ordem de `CONTRACT_VARIABLE_KEYS`, sempre.
   *
   * Chave cujo valor é `undefined` é **omitida**, não emitida com valor vazio.
   * `JSON.stringify` já faria isso sozinho no cálculo do hash; fazer aqui
   * também estende a mesma garantia a quem lê o objeto sem serializar
   * (`Object.keys`, spread, presenter) — a chave ausente é ausente em todos os
   * caminhos, e não só no que passa por `stringify`.
   */
  toJSON(): ContractVariablesJSON {
    const json: Record<string, unknown> = {};
    for (const key of CONTRACT_VARIABLE_KEYS) {
      const value = this[key];
      if (value === undefined) continue;
      json[key] = value;
    }
    return json as ContractVariablesJSON;
  }

  static fromJSON(json: any): ContractVariables {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new InvalidContractVariablesError(
        "Invalid JSON for ContractVariables",
      );
    }
    return new ContractVariables(json as ContractVariablesProps);
  }

  private validate(): void {
    for (const key of REQUIRED_TEXT_KEYS) {
      const value = this[key];
      if (typeof value !== "string" || value.trim().length === 0) {
        throw new InvalidContractVariablesError(
          `Contract variable "${key}" is required`,
        );
      }
    }

    for (const key of REQUIRED_NUMBER_KEYS) {
      const value = this[key];
      if (typeof value !== "number" || !Number.isFinite(value)) {
        throw new InvalidContractVariablesError(
          `Contract variable "${key}" must be a finite number`,
        );
      }
      if (value < 0) {
        throw new InvalidContractVariablesError(
          `Contract variable "${key}" cannot be negative`,
        );
      }
    }

    /*
     * 🔴 CC art. 412: a cláusula penal não pode exceder o valor da obrigação
     * principal (e o art. 413 ainda permite ao juiz reduzi-la por excesso).
     * Uma multa acima de 100% do cachê é cláusula nula — e cláusula nula num
     * contrato gerado por software é pior que cláusula ausente, porque dá ao
     * usuário uma confiança que o documento não sustenta.
     */
    if (this.cancelamento_multa_percentual > 100) {
      throw new InvalidContractVariablesError(
        "A multa de cancelamento não pode exceder 100% do cachê (CC art. 412)",
      );
    }

    if (this.cache_valor <= 0) {
      throw new InvalidContractVariablesError(
        "O cachê deve ser maior que zero para emitir contrato",
      );
    }

    if (this.duracao_minutos <= 0) {
      throw new InvalidContractVariablesError(
        "A duração da apresentação deve ser maior que zero",
      );
    }

    /*
     * 🔴 Cláusula de não concorrência restringe a liberdade profissional
     * (CF art. 5º, XIII) e só se sustenta limitada em tempo, espaço e
     * atividade. Os tetos moram aqui, junto do teto da multa, porque são a
     * mesma espécie de regra: limite legal que precisa ser invariante de
     * código, não frase de cláusula. Exclusividade de 100 km por 6 meses num
     * show de bar é o excesso que derruba o contrato inteiro por má-fé.
     */
    if (this.exclusividade_raio_km !== null) {
      if (
        this.exclusividade_raio_km <= 0 ||
        this.exclusividade_raio_km > MAX_EXCLUSIVIDADE_RAIO_KM
      ) {
        throw new InvalidContractVariablesError(
          `O raio de exclusividade deve estar entre 1 e ${MAX_EXCLUSIVIDADE_RAIO_KM} km`,
        );
      }
    }

    if (this.exclusividade_dias !== null) {
      if (
        this.exclusividade_dias <= 0 ||
        this.exclusividade_dias > MAX_EXCLUSIVIDADE_DIAS
      ) {
        throw new InvalidContractVariablesError(
          `A janela de exclusividade deve estar entre 1 e ${MAX_EXCLUSIVIDADE_DIAS} dias`,
        );
      }
    }

    if (this.contratado_e_banda && this.contratado_integrantes.length === 0) {
      throw new InvalidContractVariablesError(
        "Contrato de banda exige a lista de integrantes",
      );
    }
  }
}

export class InvalidContractVariablesError extends InvalidArgumentError {
  constructor(message?: string) {
    super(message ?? "Invalid contract variables");
    this.name = "InvalidContractVariablesError";
  }
}
