import { randomBytes } from "node:crypto";

import { ForbiddenException } from "@nestjs/common";

import {
  Establishment,
  EstablishmentId,
} from "../../../../establishment/domain/establishment.aggregate";
import { IEstablishmentRepository } from "../../../../establishment/domain/establishment.repository";
import { Band, BandId } from "../../../../musician/domain/band.aggregate";
import { IBandRepository } from "../../../../musician/domain/band.repository";
import {
  Musician,
  MusicianId,
} from "../../../../musician/domain/musician.aggregate";
import { IMusicianRepository } from "../../../../musician/domain/musician.repository";
import { assertNegotiationViewer } from "../../../../scheduling/application/use-cases/common/negotiation-actor";
import {
  Booking,
  BookingId,
} from "../../../../scheduling/domain/booking.aggregate";
import { IBookingRepository } from "../../../../scheduling/domain/booking.repository";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import {
  ClauseTone,
  ContractContext,
} from "../../../domain/catalog/clause.types";
import { IClauseCatalog } from "../../../domain/catalog/clause-catalog";
import { CURRENT_CONTRACT_TEMPLATE_VERSION } from "../../../domain/catalog/templates/show-contract-v1";
import { Contract } from "../../../domain/contract.aggregate";
import { IContractRepository } from "../../../domain/contract.repository";
import {
  formatarDataExtenso,
  formatarDiaSemana,
  formatarDuracao,
  formatarHora,
  formatarMoeda,
  valorPorExtenso,
} from "../../../domain/contract-format";
import { ContractParty } from "../../../domain/value-objects/contract-party.vo";
import { ContractVariables } from "../../../domain/value-objects/contract-variables.vo";
import { IContractRenderer } from "../../ports/contract-renderer.port";
import { IContractStorage } from "../../ports/contract-storage.interface";
import {
  ContractOutput,
  ContractOutputMapper,
} from "../common/contract-output";
import { IssueContractInput } from "./issue-contract.input";

/**
 * Emissão do contrato, disparada pelo `BookingConfirmedEvent`.
 *
 * ## Por que pode devolver "não emitido"
 *
 * `Musician.cpf` e `Establishment.cnpj` são nullable no schema, e o
 * `EstablishmentProfile` (que tem o endereço) é opcional. Existe hoje booking
 * confirmado entre duas partes sem nenhum documento cadastrado.
 *
 * Havia três saídas e duas são ruins: emitir com "não informado" produz papel
 * fraco justamente onde o valor do produto está; bloquear a confirmação do
 * booking quebraria os fluxos web e mobile já entregues. A terceira é esta —
 * **não emitir, dizer exatamente o que falta, e deixar a correção a um clique**.
 * As duas UIs mostram a pendência no lugar do painel de contrato, e
 * `POST /contracts/issue` reexecuta depois que o dado é preenchido.
 *
 * Isso não é a "emissão manual" recusada no plano: o gatilho continua sendo a
 * confirmação. Isto é a retentativa depois de sanar a pendência.
 */

export type IssueContractOutput =
  | { issued: true; contract: ContractOutput; already_existed: boolean }
  | { issued: false; missing: string[] };

/** Sem `0/O` e `1/I`: o código é lido em voz alta e digitado por terceiros. */
const VERIFICATION_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
const VERIFICATION_CODE_LENGTH = 10;

const DEFAULT_TOLERANCIA_ATRASO_MINUTOS = 15;
const DEFAULT_IMAGEM_PRAZO_MESES = 12;
const DEFAULT_CANCELAMENTO_MULTA_PERCENTUAL = 30;
const DEFAULT_PAGAMENTO_PRAZO_TEXTO =
  "em até 2 (dois) dias úteis contados da realização da apresentação";

export type IssueContractDeps = {
  contractRepo: IContractRepository;
  bookingRepo: IBookingRepository;
  establishmentRepo: IEstablishmentRepository;
  musicianRepo: IMusicianRepository;
  bandRepo: IBandRepository;
  catalog: IClauseCatalog;
  renderer: IContractRenderer;
  storage: IContractStorage;
  issuer: { legal_name: string; document: string };
  verificationBaseUrl: string;
  /**
   * Custódia do cachê (F1.3a).
   *
   * 🔴 `custodian_legal_name` é o nome da **instituição de pagamento** que de
   * fato mantém o valor — nunca "SoundMeet". A cláusula
   * `papel_da_plataforma.com_custodia` afirma que o valor custodiado não
   * integra o patrimônio da plataforma; escrever o nome dela aqui transformaria
   * uma cláusula assinada em declaração falsa.
   *
   * Ausente = escrow desligado, e a variante de custódia nunca é escolhida.
   */
  escrow?: { enabled: boolean; custodian_legal_name: string } | null;
  clock?: IClock;
  domainEventMediator?: DomainEventMediator;
};

export class IssueContractUseCase implements IUseCase<
  IssueContractInput,
  IssueContractOutput
> {
  private readonly clock: IClock;

  constructor(private readonly deps: IssueContractDeps) {
    this.clock = deps.clock ?? { now: () => new Date() };
  }

  async execute(input: IssueContractInput): Promise<IssueContractOutput> {
    /*
     * Primeira barreira de idempotência: reentrega do BookingConfirmedEvent
     * (retomada após crash, dupla confirmação) encontra o contrato existente e
     * vira no-op. A garantia real é a unique `(bookingId, revision)` no banco —
     * esta consulta é o caminho feliz, não a defesa.
     */
    const existing = await this.deps.contractRepo.findCurrentByBookingId(
      input.booking_id,
    );
    if (existing) {
      // Autorizar ANTES de devolver: o caminho de idempotência entrega o
      // snapshot inteiro, e sem esta checagem ele seria a rota mais barata para
      // ler contrato alheio conhecendo só um `booking_id`.
      this.assertMayIssue(input, {
        establishment_id: existing.establishment_id.id,
        musician_id: existing.musician_id?.id ?? null,
        band_id: existing.band_id?.id ?? null,
      });

      return {
        issued: true,
        contract: ContractOutputMapper.toOutput(existing),
        already_existed: true,
      };
    }

    const booking = await this.deps.bookingRepo.findById(
      new BookingId(input.booking_id),
    );
    if (!booking) {
      throw new NotFoundError(input.booking_id, Booking);
    }

    /*
     * Autorização ANTES de qualquer efeito e antes de `collectMissingQualification`.
     *
     * A ordem é o ponto. Emitir grava PDF no storage, persiste o contrato e
     * dispara `ContractIssuedEvent`, que manda o documento — com CPF, CNPJ,
     * endereço e cachê — por e-mail às duas partes. E o ramo de pendência
     * devolve o estado cadastral alheio (`contratado.cpf`,
     * `contratante.representante_legal`) a quem perguntar. Checar depois seria
     * checar quando já não adianta.
     */
    this.assertMayIssue(input, {
      establishment_id: booking.establishment_id.id,
      musician_id: booking.musician_id?.id ?? null,
      band_id: booking.band_id?.id ?? null,
    });

    const establishment = await this.deps.establishmentRepo.findById(
      new EstablishmentId(booking.establishment_id.id),
    );
    if (!establishment) {
      throw new NotFoundError(booking.establishment_id.id, Establishment);
    }

    const musician = booking.musician_id
      ? await this.deps.musicianRepo.findById(
          new MusicianId(booking.musician_id.id),
        )
      : null;
    const band = booking.band_id
      ? await this.deps.bandRepo.findById(new BandId(booking.band_id.id))
      : null;

    // Em banda quem qualifica e assina é o líder: banda não tem personalidade
    // jurídica, e quem responde precisa ser uma pessoa identificada.
    const leader = band?.leader ?? null;
    const leaderMusician = leader
      ? await this.deps.musicianRepo.findById(
          new MusicianId(leader.musician_id.id),
        )
      : null;

    const missing = this.collectMissingQualification({
      booking,
      establishment,
      musician,
      band,
      leaderMusician,
    });

    if (missing.length > 0) {
      return { issued: false, missing };
    }

    const contractor = this.buildContractor(establishment);
    const contracted = this.buildContracted({ musician, band, leaderMusician });

    const verificationCode = this.generateVerificationCode();
    // 🔴 Era `?? "UTC"`: casa sem horário de funcionamento cadastrado tinha o
    // show das 20h impresso às 23h no contrato. O fuso vem do endereço.
    const timezone = establishment.venueTimezone();
    const now = this.clock.now();

    const context = this.buildContext({
      booking,
      establishment,
      band,
      contracted,
      input,
    });
    const memberNames = band ? await this.resolveMemberNames(band) : [];
    const variables = this.buildVariables({
      booking,
      establishment,
      contractor,
      contracted,
      band,
      memberNames,
      timezone,
      verificationCode,
      now,
      context,
    });

    const template = this.deps.catalog.getTemplate(
      CURRENT_CONTRACT_TEMPLATE_VERSION,
    );
    const clauses = this.deps.catalog.render(template, context, variables);

    const rendered = await this.deps.renderer.renderContract({
      template_version: template.version,
      template_title: template.title,
      contractor: contractor.toJSON(),
      contracted: contracted.toJSON(),
      variables: variables.toJSON(),
      clauses: clauses.map((clause) => clause.toJSON()),
      content_hash: Contract.computeContentHash({
        template_version: template.version,
        contractor,
        contracted,
        variables,
        clauses,
      }),
      verification_code: verificationCode,
      verification_url: this.verificationUrl(verificationCode),
      issued_at: now,
    });

    /*
     * Sobe ao storage ANTES de persistir — mesmo precedente de
     * `upload-establishment-menu-pdf`. Arquivo órfão em caso de falha do insert
     * é o custo aceito; a alternativa (persistir e subir depois) deixaria um
     * contrato sem documento, que é o pior dos dois.
     */
    const objectKey = this.buildObjectKey({
      establishment_id: booking.establishment_id.id,
      booking_id: booking.booking_id.id,
      code: verificationCode,
      revision: 1,
      extension: rendered.file_extension,
    });

    await this.deps.storage.putObject({
      object_key: objectKey,
      data: rendered.data,
      content_type: rendered.content_type,
    });

    const contract = Contract.create({
      booking_id: booking.booking_id.id,
      establishment_id: booking.establishment_id.id,
      musician_id: booking.musician_id?.id ?? null,
      band_id: booking.band_id?.id ?? null,
      template_version: template.version,
      contractor,
      contracted,
      clauses,
      variables,
      verification_code: verificationCode,
      document_key: objectKey,
      issued_at: now,
    });

    await this.deps.contractRepo.insert(contract);

    if (this.deps.domainEventMediator) {
      await this.deps.domainEventMediator.publish(contract);
      await this.deps.domainEventMediator.publishIntegrationEvents(contract);
      contract.clearEvents();
    }

    return {
      issued: true,
      contract: ContractOutputMapper.toOutput(contract),
      already_existed: false,
    };
  }

  /**
   * Quem pode disparar a emissão daquele booking.
   *
   * Usa `assertNegotiationViewer`, e não `assertNegotiationParticipant`: emitir
   * não é ato vinculante — é a retentativa depois de sanar uma pendência de
   * cadastro. Quem se obriga é quem **assina**, e lá a liderança de banda é
   * exigida. Barrar o integrante não-líder aqui só o impediria de destravar o
   * próprio contrato. Mesma distinção de `GetContractUseCase`.
   *
   * 🔴 **Fail-closed sobre lista vazia.** `assertNegotiationViewer` pula a
   * checagem quando o ator não tem identidade nenhuma — convenção dos jobs
   * internos de scheduling. Aqui isso seria fail-open para todo token sem
   * claim utilizável, então a ausência de identidade é barrada **antes**. O
   * caminho do sistema é explícito e tipado (`null`), nunca inferido de uma
   * lista vazia.
   */
  private assertMayIssue(
    input: IssueContractInput,
    sides: {
      establishment_id: string;
      musician_id: string | null;
      band_id: string | null;
    },
  ): void {
    // `null` = `ContractIssuanceHandler`, que roda sobre `BookingConfirmedEvent`
    // sem ator HTTP. É a única forma de pular, e ela é declarada em código.
    if (input.requesting_participant_ids === null) {
      return;
    }

    /*
     * Só o `null` acima pula. Qualquer outra ausência de identidade — array
     * vazio, ou a chave faltando num chamador que escapou do `tsc` — é recusa,
     * não silêncio. `undefined` aqui produziria um TypeError e um 500 no lugar
     * de um 403, o que esconde a fiação faltando em vez de expô-la.
     */
    if (input.is_admin !== true) {
      const actorIds = Array.isArray(input.requesting_participant_ids)
        ? input.requesting_participant_ids.filter(Boolean)
        : [];

      if (actorIds.length === 0) {
        throw new ForbiddenException(
          "Você não tem permissão para emitir o contrato deste show.",
        );
      }
    }

    assertNegotiationViewer(
      {
        requesting_participant_ids: input.requesting_participant_ids,
        is_admin: input.is_admin,
      },
      sides,
      "o contrato deste show",
    );
  }

  /**
   * O que falta para qualificar as partes.
   *
   * Devolve chaves estáveis (`contratante.cnpj`, `contratado.cpf`, …) e não
   * frases: quem monta a mensagem é a UI, que sabe para onde mandar o usuário
   * corrigir cada uma.
   */
  private collectMissingQualification(params: {
    booking: Booking;
    establishment: Establishment;
    musician: Musician | null;
    band: Band | null;
    leaderMusician: Musician | null;
  }): string[] {
    const { booking, establishment, musician, band, leaderMusician } = params;
    const missing: string[] = [];

    if (!establishment.cnpj) missing.push("contratante.cnpj");
    /*
     * Pessoa jurídica não assina sozinha: sem nome E CPF do representante, a
     * qualificação do contratante fica incompleta e o contrato precisa remeter
     * ao Anexo II. O agregado tolera nome sem CPF (é dado válido, meio
     * preenchido); o contrato pede os dois, porque a qualificação completa é
     * justamente o que separa este documento de um papel fraco.
     *
     * Como toda pendência daqui: não bloqueia a confirmação do booking, só
     * adia a emissão e diz exatamente o que falta.
     */
    if (
      !establishment.legal_representative_name ||
      !establishment.legal_representative_document
    ) {
      missing.push("contratante.representante_legal");
    }
    if (!establishment.profile) missing.push("contratante.perfil");
    else if (!establishment.profile.location)
      missing.push("contratante.endereco");

    if (booking.fee === null || booking.fee <= 0) missing.push("booking.cache");

    if (band) {
      if (!band.leader) missing.push("contratado.lider_da_banda");
      if (!leaderMusician) missing.push("contratado.lider_da_banda");
      else if (!leaderMusician.cpf) missing.push("contratado.cpf_do_lider");
      if (band.acceptedMembers.length === 0) {
        missing.push("contratado.integrantes");
      }
    } else if (musician) {
      /*
       * CPF OU CNPJ: o MEI que só cadastrou o CNPJ está tão qualificado quanto
       * quem só tem CPF — a parte é identificável e o documento sai correto.
       * Exigir os dois travaria a emissão por um dado que a plataforma nunca
       * pediu.
       */
      if (!musician.cpf && !musician.cnpj) missing.push("contratado.cpf");
    } else {
      missing.push("contratado.identificacao");
    }

    /*
     * O endereço do contratado não é exigido: `Musician` não tem endereço
     * estruturado no domínio (só `location` cidade/UF no perfil), e travar a
     * emissão num dado que a plataforma nunca pediu ao músico deixaria o
     * contrato inalcançável para todo mundo. A qualificação usa o endereço do
     * local da apresentação como referência do contratado — declarado no
     * documento como tal, sem fingir precisão que não temos.
     */
    return [...new Set(missing)];
  }

  private buildContractor(establishment: Establishment): ContractParty {
    const address = establishment.profile!.location;

    return new ContractParty({
      role: "contractor",
      // Derivado pelo mesmo motivo do `contractor_is_company` em `buildContext`.
      kind: establishment.cnpj ? "company" : "individual",
      legal_name: establishment.name,
      display_name: establishment.name,
      document: establishment.cnpj!.value,
      email: establishment.email.value,
      phone: establishment.phone?.value ?? null,
      address: {
        street: address.street,
        number: address.number,
        complement: address.complement ?? null,
        neighborhood: address.neighborhood,
        city: address.city,
        state: address.state,
        zip_code: address.zipCode,
        country: address.country,
      },
      /*
       * O representante vem do cadastro, NUNCA é derivado do CNPJ.
       *
       * Derivar um documento do CNPJ — os 11 primeiros dígitos, por exemplo —
       * seria FABRICAR documento num instrumento cuja única razão de existir é
       * provar fatos, e o erro passaria despercebido até o dia em que alguém
       * conferisse. Por isso o campo é opcional em vez de preenchido a fórceps.
       *
       * Quando a casa informou nome (e opcionalmente CPF), o documento traz a
       * qualificação completa: "neste ato representada por João da Silva, CPF
       * nº …, na qualidade de representante legal". Quando não informou, o
       * documento diz a verdade — "representante legal identificado no Anexo
       * II" — e o Anexo II traz quem de fato assinou, com conta autenticada
       * pelo Keycloak, e-mail, data, IP e agente de acesso.
       *
       * A âncora de identidade da assinatura continua sendo `signer_user_id`,
       * não o CPF declarado: o cadastro diz quem deveria assinar, a trilha diz
       * quem assinou.
       */
      representative: establishment.legal_representative_name
        ? {
            name: establishment.legal_representative_name,
            document:
              establishment.legal_representative_document?.value ?? null,
            title: "representante legal",
          }
        : null,
    });
  }

  /**
   * Nomes dos integrantes aceitos, para a cláusula de objeto.
   *
   * A formação vai NOMEADA no contrato: "contratei o Trio Maré" sem dizer quem
   * toca é o que permite trocar a banda inteira no dia e discutir depois. A
   * consulta é um `findByIds` só — banda é entidade pequena, não há N+1 real.
   */
  private async resolveMemberNames(band: Band): Promise<string[]> {
    const ids = band.acceptedMembers.map(
      (member) => new MusicianId(member.musician_id.id),
    );
    if (ids.length === 0) return [];

    const musicians = await this.deps.musicianRepo.findByIds(ids);
    const byId = new Map(musicians.map((m) => [m.musician_id.id, m]));

    return ids
      .map((id) => byId.get(id.id))
      .filter((m): m is Musician => Boolean(m))
      .map((m) => m.stage_name ?? m.name);
  }

  private buildContracted(params: {
    musician: Musician | null;
    band: Band | null;
    leaderMusician: Musician | null;
  }): ContractParty {
    const { musician, band, leaderMusician } = params;

    if (band) {
      const leader = leaderMusician!;
      /*
       * A banda contrata pelo líder pessoa FÍSICA mesmo quando ele tem MEI, e
       * isso é decisão, não esquecimento: o MEI é dele, não da banda. Faturar
       * o cachê inteiro pelo CNPJ pessoal do líder cria um repasse entre
       * integrantes que este contrato não descreve em cláusula nenhuma, e pode
       * estourar o teto do MEI. Banda com CNPJ próprio é o caminho certo, e é
       * fatia futura.
       */
      return new ContractParty({
        role: "contracted",
        kind: "individual",
        legal_name: leader.name,
        display_name: band.name,
        document: leader.cpf!.value,
        email: leader.email.value,
        phone: leader.phone?.value ?? null,
        address: this.placeholderAddress(),
        representative: {
          name: leader.name,
          document: leader.cpf!.value,
          title: "líder da banda",
        },
      });
    }

    const solo = musician!;
    /*
     * Músico MEI é qualificado como pessoa jurídica, com o CNPJ no papel — é o
     * que faz o contrato bater com a nota que ele emite. Sem isso o contrato
     * dizia CPF e a nota dizia CNPJ, e a incoerência aparecia na contabilidade
     * dele.
     *
     * `legal_name` continua sendo o nome civil de propósito: a razão social do
     * MEI É o nome da pessoa (a Receita apenas lhe acrescenta os dígitos do
     * CPF), então o nome civil é o mais próximo do registro que temos sem
     * consultar a Receita — e inventar uma razão social seria repetir o erro
     * do CPF fabricado.
     */
    const isMei = solo.cnpj !== null;
    return new ContractParty({
      role: "contracted",
      kind: isMei ? "company" : "individual",
      legal_name: solo.name,
      display_name: solo.stage_name ?? solo.name,
      document: isMei ? solo.cnpj!.value : solo.cpf!.value,
      email: solo.email.value,
      phone: solo.phone?.value ?? null,
      address: this.placeholderAddress(),
      representative: null,
    });
  }

  /**
   * `Musician` não tem endereço estruturado no domínio.
   *
   * O contrato precisa de um endereço na qualificação, e inventar um seria pior
   * que declarar o que sabemos. O documento registra o endereço como "não
   * informado" na cidade do perfil quando existir — e o campo é o candidato
   * natural ao próximo incremento do cadastro do músico.
   */
  private placeholderAddress() {
    return {
      street: "Endereço não informado",
      number: "s/n",
      complement: null,
      neighborhood: "Não informado",
      city: "Não informado",
      state: "NI",
      zip_code: "00000000",
      country: "Brasil",
    };
  }

  private buildContext(params: {
    booking: Booking;
    establishment: Establishment;
    band: Band | null;
    contracted: ContractParty;
    input: IssueContractInput;
  }): ContractContext {
    const { booking, establishment, band, contracted, input } = params;
    const spec = establishment.profile?.stageTechSpec ?? null;

    return {
      target: band ? "band" : "musician",
      fee: booking.fee ?? 0,
      has_stage_tech_spec: Boolean(spec && !spec.isEmpty()),
      has_soundcheck_window: Boolean(spec?.soundcheckWindow),
      /*
       * 🔑 Único ponto de contato com o F1.3(a).
       *
       * Ligar a flag passa a selecionar `cache_pagamento.com_custodia` e a
       * incluir `custodia_liberacao` — **sem tocar em cláusula nenhuma**, porque
       * as duas já estão escritas e testadas. Desligado, a variante de custódia
       * simplesmente não é escolhida.
       *
       * 🔴 Exige o nome do custodiante: cláusula de custódia sem dizer QUEM
       * custodia é papel fraco justamente onde o valor do documento está.
       */
      uses_escrow: this.escrowEnabled(),
      outdoor: input.outdoor ?? false,
      exclusivity_requested: input.exclusivity_requested ?? false,
      /*
       * DERIVADO, não fixo — mesmo que hoje só possa dar `true`.
       *
       * `Establishment` só tem `cnpj` (não existe campo de CPF no agregado nem
       * no schema), e a emissão exige CNPJ, então na prática todo contratante é
       * pessoa jurídica. Derivar em vez de fixar `true` é o que faz a cláusula
       * de tributos escolher sozinha a redação certa no dia em que a plataforma
       * aceitar estabelecimento pessoa física: muda o cadastro, não o contrato.
       */
      contractor_is_company: establishment.cnpj !== null,
      /*
       * DERIVADO da parte já montada, e não relido do músico, para que a
       * qualificação impressa e a cláusula de tributos não possam divergir:
       * se o documento do CONTRATADO no papel é um CNPJ, a cláusula tem que
       * ser a de pessoa jurídica. Na banda dá sempre `false` — o MEI é do
       * líder, não da banda (ver `buildContracted`).
       */
      contracted_is_company: contracted.kind === "company",
      tone: (input.tone as ClauseTone) ?? "formal",
    };
  }

  private buildVariables(params: {
    booking: Booking;
    establishment: Establishment;
    contractor: ContractParty;
    contracted: ContractParty;
    band: Band | null;
    memberNames: string[];
    timezone: string;
    verificationCode: string;
    now: Date;
    context: ContractContext;
  }): ContractVariables {
    const {
      booking,
      establishment,
      contractor,
      contracted,
      band,
      memberNames,
      timezone,
      verificationCode,
      now,
      context,
    } = params;

    const cache = booking.fee ?? 0;
    const duracaoMinutos = Math.max(
      1,
      Math.round(
        (booking.end_at.getTime() - booking.start_at.getTime()) / 60000,
      ),
    );
    const multaPercentual = DEFAULT_CANCELAMENTO_MULTA_PERCENTUAL;
    const spec = establishment.profile?.stageTechSpec ?? null;

    return new ContractVariables({
      contratante_nome: contractor.reference_name,
      contratante_documento: contractor.formatted_document,
      contratante_endereco: contractor.formatted_address,
      contratante_representante: contractor.representative
        ? `${contractor.representative.name} (${contractor.representative.title})`
        : null,
      contratado_nome: contracted.reference_name,
      contratado_documento: contracted.formatted_document,
      contratado_endereco: contracted.formatted_address,
      contratado_representante: contracted.representative
        ? `${contracted.representative.name} (${contracted.representative.title})`
        : null,
      contratado_e_banda: Boolean(band),
      contratado_integrantes: band ? memberNames : [],
      data_show: formatarDataExtenso(booking.start_at, timezone),
      dia_semana: formatarDiaSemana(booking.start_at, timezone),
      hora_inicio: formatarHora(booking.start_at, timezone),
      hora_fim: formatarHora(booking.end_at, timezone),
      duracao_formatada: formatarDuracao(duracaoMinutos),
      duracao_minutos: duracaoMinutos,
      local_nome: establishment.name,
      local_endereco: contractor.formatted_address,
      comarca: `${contractor.address.city}/${contractor.address.state}`,
      fuso_horario: timezone,
      cache_valor: cache,
      cache_formatado: formatarMoeda(cache),
      cache_extenso: valorPorExtenso(cache),
      pagamento_prazo_texto: DEFAULT_PAGAMENTO_PRAZO_TEXTO,
      /*
       * Nulo quando não há custódia — a única cláusula que lê este campo é a de
       * custódia. Quando há, entra o nome da instituição de pagamento que de
       * fato mantém o valor, **e não o da plataforma**: é exatamente essa
       * distinção que as cláusulas de custódia afirmam.
       */
      custodiante_nome: this.escrowEnabled()
        ? this.deps.escrow!.custodian_legal_name
        : null,
      // Vem do booking, nunca de constante do catálogo: a janela é negociável
      // por show e o contrato precisa refletir a que vale para este.
      cancelamento_janela_horas: booking.free_cancellation_hours,
      cancelamento_multa_percentual: multaPercentual,
      cancelamento_multa_formatada: formatarMoeda(
        (cache * multaPercentual) / 100,
      ),
      passagem_som_janela: spec?.soundcheckWindow ?? null,
      ficha_tecnica_resumo: context.has_stage_tech_spec
        ? this.summarizeStageSpec(establishment)
        : null,
      /*
       * Anexo I congelado. A condição é a MESMA que escolhe a variante da
       * cláusula de estrutura (`context.has_stage_tech_spec`) de propósito: é o
       * que garante que o documento nunca afirme "descrita no Anexo I" sem o
       * anexo existir, nem imprima um anexo que nenhuma cláusula incorporou.
       *
       * 🔴 `undefined`, jamais `null` — ver `ficha_tecnica_anexo` no VO. O
       * construtor também apaga a chave, mas manter a intenção explícita aqui
       * evita que alguém "padronize" isto para `?? null` como os campos vizinhos.
       */
      ficha_tecnica_anexo: context.has_stage_tech_spec
        ? spec!.toJSON()
        : undefined,
      tolerancia_atraso_minutos: DEFAULT_TOLERANCIA_ATRASO_MINUTOS,
      // Hora adicional proporcional ao cachê pela duração contratada — é a
      // única base defensável, e evita número mágico no contrato.
      hora_extra_valor_formatado: formatarMoeda(
        Math.round((cache / (duracaoMinutos / 60)) * 100) / 100,
      ),
      exclusividade_raio_km: context.exclusivity_requested ? 10 : null,
      exclusividade_dias: context.exclusivity_requested ? 7 : null,
      imagem_prazo_meses: DEFAULT_IMAGEM_PRAZO_MESES,
      plataforma_nome: this.deps.issuer.legal_name,
      plataforma_documento: this.deps.issuer.document,
      codigo_verificacao: verificationCode,
      url_verificacao: this.verificationUrl(verificationCode),
      emitido_em: formatarDataExtenso(now, timezone),
    });
  }

  /**
   * A custódia só entra no documento com nome de custodiante preenchido.
   *
   * Ligar a flag sem o nome produziria um contrato que promete custódia e não
   * diz onde — e a variante `cache_pagamento.com_custodia` renderiza esse campo
   * no corpo. Falha para o lado seguro: sem o nome, o contrato descreve o
   * pagamento direto, que é o que de fato acontece.
   */
  private escrowEnabled(): boolean {
    return Boolean(
      this.deps.escrow?.enabled &&
      this.deps.escrow.custodian_legal_name?.trim(),
    );
  }

  private summarizeStageSpec(establishment: Establishment): string {
    const spec = establishment.profile!.stageTechSpec!;
    const partes: string[] = [];

    if (spec.hasPa !== null) partes.push(spec.hasPa ? "PA" : "sem PA");
    if (spec.mixerChannels !== null) {
      partes.push(`${spec.mixerChannels} canais`);
    }
    if (spec.monitors !== null) partes.push(`${spec.monitors} retornos`);
    if (spec.backline.length > 0) {
      partes.push(`backline: ${spec.backline.join(", ")}`);
    }
    if (spec.hasSoundEngineer !== null) {
      partes.push(
        spec.hasSoundEngineer ? "operador de som" : "sem operador de som",
      );
    }

    return partes.length > 0 ? partes.join("; ") : "conforme Anexo I";
  }

  private buildObjectKey(params: {
    establishment_id: string;
    booking_id: string;
    code: string;
    revision: number;
    extension: string;
  }): string {
    // Sem PII no caminho: só ids opacos e o código de verificação.
    return `contracts/${params.establishment_id}/${params.booking_id}/${params.code}/contrato-r${params.revision}.${params.extension}`;
  }

  private verificationUrl(code: string): string {
    const base = this.deps.verificationBaseUrl.endsWith("/")
      ? this.deps.verificationBaseUrl.slice(0, -1)
      : this.deps.verificationBaseUrl;
    return `${base}/${code}`;
  }

  private generateVerificationCode(): string {
    const bytes = randomBytes(VERIFICATION_CODE_LENGTH);
    let code = "";
    for (let i = 0; i < VERIFICATION_CODE_LENGTH; i++) {
      code += VERIFICATION_ALPHABET[bytes[i] % VERIFICATION_ALPHABET.length];
    }
    return code;
  }
}
