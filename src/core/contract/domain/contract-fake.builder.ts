import { Chance } from "chance";

import { Uuid } from "../../shared/domain";
import { ContractContext } from "./catalog/clause.types";
import { ClauseCatalog } from "./catalog/clause-catalog";
import { SHOW_CONTRACT_V1 } from "./catalog/templates/show-contract-v1";
import { Contract, ContractId } from "./contract.aggregate";
import { formatarMoeda, valorPorExtenso } from "./contract-format";
import { ContractStatus } from "./contract-types";
import { ContractParty } from "./value-objects/contract-party.vo";
import {
  ContractVariables,
  ContractVariablesProps,
} from "./value-objects/contract-variables.vo";
import { RenderedClause } from "./value-objects/rendered-clause.vo";

type PropOrFactory<T> = T | ((index: number) => T);

/**
 * Builder de contrato para testes.
 *
 * Diferente dos demais builders do projeto, este **usa o catálogo real** para
 * montar as cláusulas em vez de inventar texto. É deliberado: um contrato falso
 * com cláusula falsa não exercita a única parte do domínio que pode falhar em
 * produção de um jeito caro — a resolução de variantes. Quem precisa de
 * cláusula sintética passa `withClauses()`.
 */
export class ContractFakeBuilder<TBuild = any> {
  private _contract_id: PropOrFactory<ContractId | undefined> = undefined;
  private _booking_id: PropOrFactory<string> = () =>
    this.chance.guid({ version: 4 });
  private _establishment_id: PropOrFactory<string> = () =>
    this.chance.guid({ version: 4 });
  private _musician_id: PropOrFactory<string | null> = () =>
    this.chance.guid({ version: 4 });
  private _band_id: PropOrFactory<string | null> = null;
  private _status: PropOrFactory<ContractStatus> = "issued";
  private _context: PropOrFactory<ContractContext> = () =>
    ContractFakeBuilder.defaultContext();
  private _variables: PropOrFactory<ContractVariables | undefined> = undefined;
  private _clauses: PropOrFactory<RenderedClause[] | undefined> = undefined;
  private _contractor: PropOrFactory<ContractParty | undefined> = undefined;
  private _contracted: PropOrFactory<ContractParty | undefined> = undefined;
  private _verification_code: PropOrFactory<string> = () =>
    this.chance
      .string({ length: 10, alpha: true, numeric: true })
      .toUpperCase();
  private _document_key: PropOrFactory<string | null> = null;
  private _issued_at: PropOrFactory<Date> = () =>
    new Date("2026-08-01T12:00:00Z");
  private countObjs: number;
  private chance: Chance.Chance;

  static aContract() {
    return new ContractFakeBuilder<Contract>();
  }

  static theContracts(count: number) {
    return new ContractFakeBuilder<Contract[]>(count);
  }

  private constructor(count: number = 1) {
    this.countObjs = count;
    this.chance = new Chance();
  }

  static defaultContext(): ContractContext {
    return {
      target: "musician",
      fee: 1500,
      has_stage_tech_spec: true,
      has_soundcheck_window: true,
      uses_escrow: false,
      outdoor: false,
      exclusivity_requested: false,
      contractor_is_company: true,
      contracted_is_company: false,
      tone: "formal",
    };
  }

  static defaultVariables(
    overrides: Partial<ContractVariablesProps> = {},
  ): ContractVariables {
    return new ContractVariables({
      contratante_nome: "Bar do Zé Ltda.",
      contratante_documento: "12.345.678/0001-90",
      contratante_endereco:
        "Rua das Flores, 100 — Centro — São Paulo/SP — CEP 01000-000",
      contratante_representante: "José da Silva (representante legal)",
      contratado_nome: "Ana Ribeiro",
      contratado_documento: "123.456.789-01",
      contratado_endereco:
        "Rua das Acácias, 42 — Vila Mariana — São Paulo/SP — CEP 04000-000",
      contratado_representante: null,
      contratado_e_banda: false,
      contratado_integrantes: [],
      data_show: "12 de setembro de 2026",
      dia_semana: "sábado",
      hora_inicio: "21:00",
      hora_fim: "23:30",
      duracao_formatada: "2h30",
      duracao_minutos: 150,
      local_nome: "Bar do Zé",
      local_endereco:
        "Rua das Flores, 100 — Centro — São Paulo/SP — CEP 01000-000",
      comarca: "São Paulo/SP",
      fuso_horario: "America/Sao_Paulo",
      cache_valor: 1500,
      cache_formatado: "R$ 1.500,00",
      cache_extenso: "mil e quinhentos reais",
      pagamento_prazo_texto: "em até 2 (dois) dias úteis após a apresentação",
      custodiante_nome: null,
      cancelamento_janela_horas: 72,
      cancelamento_multa_percentual: 30,
      cancelamento_multa_formatada: "R$ 450,00",
      passagem_som_janela: "18:00-19:00",
      ficha_tecnica_resumo: "PA, 4 retornos, 12 canais, backline de bateria",
      tolerancia_atraso_minutos: 15,
      hora_extra_valor_formatado: "R$ 300,00",
      exclusividade_raio_km: null,
      exclusividade_dias: null,
      imagem_prazo_meses: 12,
      plataforma_nome: "SoundMeet",
      plataforma_documento: "00.000.000/0001-00",
      codigo_verificacao: "ABC123XYZ",
      url_verificacao: "https://soundmeet.com.br/contrato/ABC123XYZ",
      emitido_em: "1 de agosto de 2026",
      ...overrides,
    });
  }

  /**
   * Variáveis **coerentes com o contexto**.
   *
   * O contexto e as variáveis não são independentes: `uses_escrow` exige o
   * custodiante,
   * `exclusivity_requested` exige raio e janela, `has_soundcheck_window` exige a
   * janela, e banda exige integrantes. Um teste que varra combinações precisa
   * respeitar essas dependências, senão exercita estados que a aplicação nunca
   * produz e falha por motivo errado.
   */
  static variablesFor(context: ContractContext): ContractVariables {
    const cache = context.fee;
    const multaPercentual = 30;

    return ContractFakeBuilder.defaultVariables({
      contratado_e_banda: context.target === "band",
      contratado_integrantes:
        context.target === "band"
          ? ["Ana Ribeiro", "Bruno Costa", "Carla Dias"]
          : [],
      contratado_nome: context.target === "band" ? "Trio Maré" : "Ana Ribeiro",
      contratado_representante:
        context.target === "band" ? "Ana Ribeiro (líder da banda)" : null,
      contratante_documento: context.contractor_is_company
        ? "12.345.678/0001-90"
        : "987.654.321-00",
      // MEI aparece com CNPJ; sem MEI, com CPF — o mesmo que `buildContracted`
      // faz na emissão real.
      contratado_documento: context.contracted_is_company
        ? "11.222.333/0001-81"
        : "123.456.789-01",
      cache_valor: cache,
      cache_formatado: formatarMoeda(cache),
      cache_extenso: valorPorExtenso(cache),
      cancelamento_multa_percentual: multaPercentual,
      cancelamento_multa_formatada: formatarMoeda(
        (cache * multaPercentual) / 100,
      ),
      custodiante_nome: context.uses_escrow ? "Asaas" : null,
      passagem_som_janela: context.has_soundcheck_window ? "18:00-19:00" : null,
      ficha_tecnica_resumo: context.has_stage_tech_spec
        ? "PA, 4 retornos, 12 canais, backline de bateria"
        : null,
      /*
       * Anexo I congelado — mesma condição da variante de cláusula, como em
       * produção. 🔴 `undefined`, nunca `null`: é a invariante que preserva o
       * `content_hash` de contrato emitido antes desta chave existir. Um fake
       * que devolvesse `null` faria os testes passarem enquanto a produção
       * quebraria — o pior tipo de fixture.
       */
      ficha_tecnica_anexo: context.has_stage_tech_spec
        ? {
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
          }
        : undefined,
      exclusividade_raio_km: context.exclusivity_requested ? 10 : null,
      exclusividade_dias: context.exclusivity_requested ? 7 : null,
    });
  }

  static defaultContractor(): ContractParty {
    return new ContractParty({
      role: "contractor",
      kind: "company",
      legal_name: "Bar do Zé Ltda.",
      display_name: "Bar do Zé",
      document: "12345678000190",
      email: "contato@bardoze.com.br",
      phone: "+5511999990000",
      address: {
        street: "Rua das Flores",
        number: "100",
        complement: null,
        neighborhood: "Centro",
        city: "São Paulo",
        state: "SP",
        zip_code: "01000000",
        country: "Brasil",
      },
      representative: {
        name: "José da Silva",
        document: "98765432100",
        title: "representante legal",
      },
    });
  }

  static defaultContracted(): ContractParty {
    return new ContractParty({
      role: "contracted",
      kind: "individual",
      legal_name: "Ana Ribeiro",
      display_name: "Ana Ribeiro",
      document: "12345678901",
      email: "ana@exemplo.com",
      phone: "+5511988880000",
      address: {
        street: "Rua das Acácias",
        number: "42",
        complement: "apto 12",
        neighborhood: "Vila Mariana",
        city: "São Paulo",
        state: "SP",
        zip_code: "04000000",
        country: "Brasil",
      },
      representative: null,
    });
  }

  withContractId(value: PropOrFactory<ContractId>) {
    this._contract_id = value;
    return this;
  }

  withBookingId(value: PropOrFactory<string>) {
    this._booking_id = value;
    return this;
  }

  withEstablishmentId(value: PropOrFactory<string>) {
    this._establishment_id = value;
    return this;
  }

  withMusicianId(value: PropOrFactory<string>) {
    this._musician_id = value;
    this._band_id = null;
    return this;
  }

  withBandId(value: PropOrFactory<string>) {
    this._band_id = value;
    this._musician_id = null;
    return this;
  }

  withStatus(value: PropOrFactory<ContractStatus>) {
    this._status = value;
    return this;
  }

  withContext(value: PropOrFactory<ContractContext>) {
    this._context = value;
    return this;
  }

  withVariables(value: PropOrFactory<ContractVariables>) {
    this._variables = value;
    return this;
  }

  withClauses(value: PropOrFactory<RenderedClause[]>) {
    this._clauses = value;
    return this;
  }

  withContractor(value: PropOrFactory<ContractParty>) {
    this._contractor = value;
    return this;
  }

  withContracted(value: PropOrFactory<ContractParty>) {
    this._contracted = value;
    return this;
  }

  withVerificationCode(value: PropOrFactory<string>) {
    this._verification_code = value;
    return this;
  }

  withDocumentKey(value: PropOrFactory<string | null>) {
    this._document_key = value;
    return this;
  }

  withIssuedAt(value: PropOrFactory<Date>) {
    this._issued_at = value;
    return this;
  }

  build(): TBuild {
    const catalog = new ClauseCatalog();

    const contracts = new Array(this.countObjs).fill(undefined).map((_, i) => {
      const variables =
        this._call(this._variables, i) ??
        ContractFakeBuilder.defaultVariables();
      const context = this._call(this._context, i);
      const clauses =
        this._call(this._clauses, i) ??
        catalog.render(SHOW_CONTRACT_V1, context, variables);
      const contractor =
        this._call(this._contractor, i) ??
        ContractFakeBuilder.defaultContractor();
      const contracted =
        this._call(this._contracted, i) ??
        ContractFakeBuilder.defaultContracted();

      const contract = new Contract({
        contract_id: this._call(this._contract_id, i),
        booking_id: new Uuid(this._call(this._booking_id, i)),
        establishment_id: new Uuid(this._call(this._establishment_id, i)),
        musician_id: this.toUuid(this._call(this._musician_id, i)),
        band_id: this.toUuid(this._call(this._band_id, i)),
        template_version: SHOW_CONTRACT_V1.version,
        status: this._call(this._status, i),
        contractor,
        contracted,
        clauses,
        variables,
        content_hash: Contract.computeContentHash({
          template_version: SHOW_CONTRACT_V1.version,
          contractor,
          contracted,
          variables,
          clauses,
        }),
        verification_code: this._call(this._verification_code, i),
        document_key: this._call(this._document_key, i),
        issued_at: this._call(this._issued_at, i),
      });

      return contract;
    });

    return (this.countObjs === 1 ? contracts[0] : contracts) as TBuild;
  }

  private toUuid(value: string | null | undefined): Uuid | null {
    return value ? new Uuid(value) : null;
  }

  private _call<T>(prop: PropOrFactory<T>, index: number): T {
    return typeof prop === "function"
      ? (prop as (index: number) => T)(index)
      : prop;
  }
}
