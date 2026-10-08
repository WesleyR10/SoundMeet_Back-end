import {
  Establishment,
  EstablishmentId,
} from "../../../../../establishment/domain/establishment.aggregate";
import { EstablishmentProfile } from "../../../../../establishment/domain/establishment-profile.aggregate";
import { EstablishmentInMemoryRepository } from "../../../../../establishment/infra/db/in-memory/establishment-in-memory.repository";
import { Band, BandId } from "../../../../../musician/domain/band.aggregate";
import {
  Musician,
  MusicianId,
} from "../../../../../musician/domain/musician.aggregate";
import { BandInMemoryRepository } from "../../../../../musician/infra/db/in-memory/band-in-memory.repository";
import { MusicianInMemoryRepository } from "../../../../../musician/infra/db/in-memory/musician-in-memory.repository";
import { Booking } from "../../../../../scheduling/domain/booking.aggregate";
import { BookingInMemoryRepository } from "../../../../../scheduling/infra/db/in-memory/booking-in-memory.repository";
import { Address } from "../../../../../shared/domain/value-objects/address.vo";
import { OperatingHours } from "../../../../../shared/domain/value-objects/operating-hours.vo";
import { StageTechSpec } from "../../../../../shared/domain/value-objects/stage-tech-spec.vo";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { ClauseCatalog } from "../../../../domain/catalog/clause-catalog";
import { ContractInMemoryRepository } from "../../../../infra/db/in-memory/contract-in-memory.repository";
import {
  ContractRenderInput,
  IContractRenderer,
  RenderedDocument,
} from "../../../ports/contract-renderer.port";
import { IContractStorage } from "../../../ports/contract-storage.interface";
import { IssueContractUseCase } from "../issue-contract.use-case";

/** Renderer de teste: não gera PDF, mas registra o que recebeu. */
class RecordingRenderer implements IContractRenderer {
  lastContractInput: ContractRenderInput | null = null;

  async renderContract(input: ContractRenderInput): Promise<RenderedDocument> {
    this.lastContractInput = input;
    return {
      data: Buffer.from("%PDF-fake"),
      content_type: "application/pdf",
      file_extension: "pdf",
    };
  }

  async renderSignatureCertificate(): Promise<RenderedDocument> {
    return {
      data: Buffer.from("%PDF-cert"),
      content_type: "application/pdf",
      file_extension: "pdf",
    };
  }
}

class InMemoryStorage implements IContractStorage {
  objects = new Map<string, { content_type: string; size: number }>();

  async putObject(input: {
    object_key: string;
    data: Buffer;
    content_type: string;
  }): Promise<void> {
    this.objects.set(input.object_key, {
      content_type: input.content_type,
      size: input.data.length,
    });
  }

  async getObject() {
    return null;
  }

  async deleteObject(input: { object_key: string }): Promise<void> {
    this.objects.delete(input.object_key);
  }
}

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const BAND_ID = "33333333-3333-4333-8333-333333333333";
const MEMBER_ID = "44444444-4444-4444-8444-444444444444";
const NOW = new Date("2026-08-15T12:00:00Z");

describe("IssueContractUseCase", () => {
  let contractRepo: ContractInMemoryRepository;
  let bookingRepo: BookingInMemoryRepository;
  let establishmentRepo: EstablishmentInMemoryRepository;
  let musicianRepo: MusicianInMemoryRepository;
  let bandRepo: BandInMemoryRepository;
  let renderer: RecordingRenderer;
  let storage: InMemoryStorage;
  let useCase: IssueContractUseCase;

  function buildEstablishment(
    overrides: {
      cnpj?: string | null;
      withProfile?: boolean;
      representativeName?: string | null;
      representativeDocument?: string | null;
    } = {},
  ): Establishment {
    const {
      cnpj = "11222333000181",
      withProfile = true,
      representativeName = "João da Silva",
      representativeDocument = "52998224725",
    } = overrides;

    const profile = withProfile
      ? new EstablishmentProfile({
          establishment_id: new Uuid(ESTABLISHMENT_ID),
          location: new Address({
            street: "Rua das Flores",
            number: "100",
            neighborhood: "Centro",
            city: "São Paulo",
            state: "SP",
            zipCode: "01000000",
            country: "Brasil",
          }),
          operatingHours: new OperatingHours({
            timezone: "America/Sao_Paulo",
          }),
          stageTechSpec: new StageTechSpec({
            hasPa: true,
            monitors: 4,
            mixerChannels: 12,
            backline: ["bateria"],
            soundcheckWindow: "18:00-19:00",
          }),
        })
      : null;

    const establishment = Establishment.fake()
      .anEstablishment()
      .withEstablishmentId(new EstablishmentId(ESTABLISHMENT_ID))
      .withName("Bar do Zé")
      .withEmail("contato@bardoze.com.br")
      .withCnpj(cnpj)
      .withLegalRepresentative(representativeName, representativeDocument)
      .build();

    // `withProfile(null)` do builder cai no default em vez de zerar; atribuir
    // direto é o único jeito de exercitar o estabelecimento sem perfil — que é
    // exatamente o estado que existe hoje em produção (o cadastro não cria
    // perfil, e o perfil é quem tem o endereço).
    establishment.profile = profile;

    return establishment;
  }

  function buildMusician(
    cpf: string | null = "52998224725",
    cnpj: string | null = null,
  ): Musician {
    return Musician.fake()
      .aMusician()
      .withMusicianId(new MusicianId(MUSICIAN_ID))
      .withName("Ana Ribeiro")
      .withStageName("Ana Ribeiro")
      .withEmail("ana@exemplo.com")
      .withCpf(cpf)
      .withCnpj(cnpj)
      .build();
  }

  /**
   * Construído por `Booking.create` e não pelo fake builder: o builder de
   * scheduling não expõe `withFee`, e o cachê é justamente o dado central do
   * contrato.
   */
  function buildBooking(overrides: Partial<any> = {}): Booking {
    return Booking.create({
      establishment_id: ESTABLISHMENT_ID,
      musician_id: MUSICIAN_ID,
      start_at: new Date("2026-09-12T00:00:00Z"),
      end_at: new Date("2026-09-12T02:30:00Z"),
      fee: 1500,
      ...overrides,
    });
  }

  beforeEach(() => {
    contractRepo = new ContractInMemoryRepository();
    bookingRepo = new BookingInMemoryRepository();
    establishmentRepo = new EstablishmentInMemoryRepository();
    musicianRepo = new MusicianInMemoryRepository();
    bandRepo = new BandInMemoryRepository();
    renderer = new RecordingRenderer();
    storage = new InMemoryStorage();

    useCase = new IssueContractUseCase({
      contractRepo,
      bookingRepo,
      establishmentRepo,
      musicianRepo,
      bandRepo,
      catalog: new ClauseCatalog(),
      renderer,
      storage,
      issuer: { legal_name: "SoundMeet", document: "00000000000191" },
      verificationBaseUrl: "https://soundmeet.com.br/contrato",
      clock: { now: () => NOW },
    });
  });

  describe("qualificação das partes", () => {
    it("NÃO emite quando falta CNPJ do estabelecimento, e diz o que falta", async () => {
      await establishmentRepo.insert(buildEstablishment({ cnpj: null }));
      await musicianRepo.insert(buildMusician());
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(output).toEqual({ issued: false, missing: ["contratante.cnpj"] });
      expect(contractRepo.items).toHaveLength(0);
      expect(storage.objects.size).toBe(0);
    });

    it("NÃO emite quando falta CPF do músico", async () => {
      await establishmentRepo.insert(buildEstablishment());
      await musicianRepo.insert(buildMusician(null));
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(output).toEqual({ issued: false, missing: ["contratado.cpf"] });
    });

    it("NÃO emite quando falta o perfil (e portanto o endereço)", async () => {
      await establishmentRepo.insert(
        buildEstablishment({ withProfile: false }),
      );
      await musicianRepo.insert(buildMusician());
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(output).toEqual({
        issued: false,
        missing: ["contratante.perfil"],
      });
    });

    it("NÃO emite booking sem cachê — contrato sem valor não é contrato", async () => {
      await establishmentRepo.insert(buildEstablishment());
      await musicianRepo.insert(buildMusician());
      const booking = buildBooking({ fee: null });
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(output).toEqual({ issued: false, missing: ["booking.cache"] });
    });

    it("acumula todas as pendências de uma vez", async () => {
      await establishmentRepo.insert(buildEstablishment({ cnpj: null }));
      await musicianRepo.insert(buildMusician(null));
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(output).toEqual({
        issued: false,
        missing: expect.arrayContaining(["contratante.cnpj", "contratado.cpf"]),
      });
    });
  });

  describe("emissão", () => {
    beforeEach(async () => {
      await establishmentRepo.insert(buildEstablishment());
      await musicianRepo.insert(buildMusician());
    });

    it("emite, sobe o documento e congela o snapshot", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(output.issued).toBe(true);
      if (!output.issued) return;

      expect(output.already_existed).toBe(false);
      expect(output.contract.status).toBe("issued");
      expect(output.contract.clauses.length).toBeGreaterThan(15);
      expect(output.contract.content_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(output.contract.pending_signatures).toEqual([
        "contractor",
        "contracted",
      ]);
      expect(output.contract.has_document).toBe(true);
      expect(storage.objects.size).toBe(1);

      // A chave não carrega PII: só ids opacos e o código de verificação.
      const [key] = [...storage.objects.keys()];
      expect(key).toContain(`contracts/${ESTABLISHMENT_ID}/`);
      expect(key).not.toContain("Ana");
      expect(key).not.toContain("52998224725");
    });

    it("resolve as variáveis a partir do booking, no fuso do estabelecimento", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });
      if (!output.issued) throw new Error("deveria emitir");

      const v = output.contract.variables;
      expect(v.cache_formatado).toBe("R$ 1.500,00");
      expect(v.cache_extenso).toBe("mil e quinhentos reais");
      expect(v.duracao_formatada).toBe("2h30");
      expect(v.fuso_horario).toBe("America/Sao_Paulo");
      // 12/09 00:00 UTC é 11/09 21:00 em São Paulo.
      expect(v.hora_inicio).toBe("21:00");
      expect(v.data_show).toBe("11 de setembro de 2026");
      // Vem do booking, nunca de constante do catálogo.
      expect(v.cancelamento_janela_horas).toBe(booking.free_cancellation_hours);
    });

    it("leva a Ficha Técnica ao renderer como Anexo I, pelo snapshot congelado", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      /*
       * ⚠️ Este teste mudou de endereço em 16/ago/2026, e a mudança É o ponto.
       * Antes o anexo chegava ao renderer por um campo próprio da porta
       * (`input.stage_tech_spec`), lido do perfil VIVO e fora do
       * `content_hash`. Agora vem de `variables`, que é o que o hash cobre —
       * ler daqui é o que prova que o anexo impresso é o anexo congelado.
       */
      expect(
        renderer.lastContractInput?.variables.ficha_tecnica_anexo,
      ).toMatchObject({
        hasPa: true,
        monitors: 4,
        soundcheckWindow: "18:00-19:00",
      });
    });

    it("o Anexo I entra no content_hash — editar a ficha muda o hash", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });
      const hashComFicha = renderer.lastContractInput!.content_hash;

      // Mesmo contexto, ficha diferente: se o anexo estivesse fora do hash (como
      // até 15/ago/2026), os dois documentos sairiam com o MESMO resumo
      // criptográfico — e conferir o hash não detectaria a troca do anexo.
      const outroBooking = buildBooking();
      await bookingRepo.insert(outroBooking);

      const comOutraFicha = buildEstablishment();
      comOutraFicha.profile!.changeStageTechSpec(
        new StageTechSpec({ hasPa: false, monitors: 1 }),
      );
      await establishmentRepo.update(comOutraFicha);

      await useCase.execute({
        booking_id: outroBooking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(renderer.lastContractInput!.content_hash).not.toBe(hashComFicha);
    });

    /**
     * 🔴 A regressão da reentrega do BookingConfirmedEvent. Um segundo contrato
     * para o mesmo booking significaria duas versões do mesmo acordo
     * circulando, e nenhuma delas seria "a" válida.
     */
    it("é idempotente: reentrega do evento não cria segundo contrato", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const first = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });
      const second = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(contractRepo.items).toHaveLength(1);
      expect(storage.objects.size).toBe(1);
      if (!first.issued || !second.issued) throw new Error("deveria emitir");
      expect(second.already_existed).toBe(true);
      expect(second.contract.id).toBe(first.contract.id);
    });

    it("gera código de verificação sem caracteres ambíguos", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });
      if (!output.issued) throw new Error("deveria emitir");

      expect(output.contract.verification_code).toMatch(
        /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{10}$/,
      );
    });

    it("seleciona a redação de custódia apenas quando houver escrow (hoje: nunca)", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });
      if (!output.issued) throw new Error("deveria emitir");

      const pagamento = output.contract.clauses.find(
        (c) => c.key === "cache_pagamento",
      );
      expect(pagamento?.variant_id).toBe("cache_pagamento.direto.formal");
      expect(output.contract.variables.custodiante_nome).toBeNull();
      // Sem custódia não há o que liberar: a cláusula não entra no documento.
      expect(
        output.contract.clauses.some((c) => c.key === "custodia_liberacao"),
      ).toBe(false);
    });

    it("aplica o tom pedido e as opções de contexto", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
        tone: "rigoroso",
        outdoor: true,
        exclusivity_requested: true,
      });
      if (!output.issued) throw new Error("deveria emitir");

      const keys = output.contract.clauses.map((c) => c.key);
      expect(keys).toContain("conduta");
      expect(keys).toContain("exclusividade_raio");
      expect(
        output.contract.clauses.find((c) => c.key === "caso_fortuito")
          ?.variant_id,
      ).toBe("caso_fortuito.ao_ar_livre.formal");
    });
  });

  /*
   * Pessoa jurídica não age sozinha. A qualificação correta é "Bar do Zé
   * Ltda., CNPJ nº …, neste ato representada por João da Silva, CPF nº …".
   * O que o código NÃO faz, e não pode voltar a fazer, é derivar esse CPF dos
   * 11 primeiros dígitos do CNPJ — fabricar documento num instrumento cuja
   * razão de existir é provar fatos.
   */
  describe("representante legal do estabelecimento", () => {
    it("leva nome e CPF do representante à qualificação", async () => {
      await establishmentRepo.insert(buildEstablishment());
      await musicianRepo.insert(buildMusician());
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(renderer.lastContractInput!.contractor.representative).toEqual({
        name: "João da Silva",
        document: "52998224725",
        title: "representante legal",
      });
    });

    it("NUNCA deriva o documento do representante a partir do CNPJ", async () => {
      const cnpj = "11222333000181";
      await establishmentRepo.insert(
        buildEstablishment({
          cnpj,
          representativeName: "João da Silva",
          representativeDocument: "52998224725",
        }),
      );
      await musicianRepo.insert(buildMusician());
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      const doc =
        renderer.lastContractInput!.contractor.representative!.document;
      expect(doc).not.toBe(cnpj.slice(0, 11));
      expect(doc).toBe("52998224725");
    });

    it("NÃO emite quando o representante não foi informado, e diz o que falta", async () => {
      await establishmentRepo.insert(
        buildEstablishment({
          representativeName: null,
          representativeDocument: null,
        }),
      );
      await musicianRepo.insert(buildMusician());
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(output).toEqual({
        issued: false,
        missing: ["contratante.representante_legal"],
      });
      expect(contractRepo.items).toHaveLength(0);
    });

    it("NÃO emite com representante pela metade — nome sem CPF", async () => {
      await establishmentRepo.insert(
        buildEstablishment({
          representativeName: "João da Silva",
          representativeDocument: null,
        }),
      );
      await musicianRepo.insert(buildMusician());
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(output).toEqual({
        issued: false,
        missing: ["contratante.representante_legal"],
      });
    });
  });

  /*
   * O músico MEI é pessoa jurídica, e isso não é cosmético: ele emite nota e
   * recolhe pelo DAS, então NÃO sofre retenção previdenciária do tomador
   * (art. 4º da Lei 10.666/2003 alcança o contribuinte individual). Um contrato
   * que mandasse o bar reter INSS dele estaria instruindo retenção indevida.
   */
  describe("músico MEI", () => {
    const MEI_CNPJ = "11222333000181";

    it("qualifica como pessoa jurídica, com o CNPJ no documento", async () => {
      await establishmentRepo.insert(buildEstablishment());
      await musicianRepo.insert(buildMusician("52998224725", MEI_CNPJ));
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      const contracted = renderer.lastContractInput!.contracted;
      expect(contracted.kind).toBe("company");
      expect(contracted.document).toBe(MEI_CNPJ);
      // O nome civil permanece: a razão social do MEI É o nome da pessoa.
      expect(contracted.legal_name).toBe("Ana Ribeiro");
    });

    it("escolhe a cláusula de tributos SEM retenção previdenciária", async () => {
      await establishmentRepo.insert(buildEstablishment());
      await musicianRepo.insert(buildMusician("52998224725", MEI_CNPJ));
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      const tributos = renderer.lastContractInput!.clauses.find(
        (clause) => clause.key === "tributos",
      );
      expect(tributos!.variant_id).toBe("tributos.contratado_pj.formal");
      expect(tributos!.body).toContain(
        "Não há retenção de contribuição previdenciária na fonte",
      );
      expect(tributos!.body).not.toContain("efetuará as retenções na fonte");
    });

    it("mantém a retenção quando o músico NÃO é MEI", async () => {
      await establishmentRepo.insert(buildEstablishment());
      await musicianRepo.insert(buildMusician("52998224725", null));
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      const tributos = renderer.lastContractInput!.clauses.find(
        (clause) => clause.key === "tributos",
      );
      expect(tributos!.variant_id).toBe("tributos.contratante_pj.formal");
      expect(tributos!.body).toContain("contribuição previdenciária");
    });

    it("emite para quem tem só CNPJ, sem exigir o CPF", async () => {
      await establishmentRepo.insert(buildEstablishment());
      await musicianRepo.insert(buildMusician(null, MEI_CNPJ));
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(output.issued).toBe(true);
      expect(renderer.lastContractInput!.contracted.document).toBe(MEI_CNPJ);
    });

    it("continua exigindo documento de quem não tem nem CPF nem CNPJ", async () => {
      await establishmentRepo.insert(buildEstablishment());
      await musicianRepo.insert(buildMusician(null, null));
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(output).toEqual({ issued: false, missing: ["contratado.cpf"] });
    });

    /*
     * O MEI é do líder, não da banda. Faturar o cachê inteiro pelo CNPJ pessoal
     * dele cria um repasse entre integrantes que nenhuma cláusula descreve, e
     * pode estourar o teto do MEI — decisão registrada em `buildContracted`.
     */
    it("NÃO aplica o MEI do líder ao contrato da banda", async () => {
      await establishmentRepo.insert(buildEstablishment());
      const leader = buildMusician("52998224725", MEI_CNPJ);
      const member = Musician.fake()
        .aMusician()
        .withMusicianId(new MusicianId(MEMBER_ID))
        .withName("Bruno Costa")
        .withStageName(null)
        .withEmail("bruno@exemplo.com")
        .withCpf("71428793860")
        .build();
      await musicianRepo.bulkInsert([leader, member]);

      const band = Band.fake()
        .aBand()
        .withBandId(new BandId(BAND_ID))
        .withName("Trio Maré")
        .withMembers([
          {
            musician_id: new Uuid(MUSICIAN_ID),
            role: "leader",
            status: "accepted",
          },
          {
            musician_id: new Uuid(MEMBER_ID),
            role: "member",
            status: "accepted",
          },
        ] as any)
        .build();
      await bandRepo.insert(band);

      const booking = buildBooking({ band_id: BAND_ID, musician_id: null });
      await bookingRepo.insert(booking);

      await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      const contracted = renderer.lastContractInput!.contracted;
      expect(contracted.kind).toBe("individual");
      expect(contracted.document).toBe("52998224725");
      expect(
        renderer.lastContractInput!.clauses.find((c) => c.key === "tributos")!
          .variant_id,
      ).toBe("tributos.contratante_pj.formal");
    });
  });

  describe("contrato de banda", () => {
    it("qualifica o líder e nomeia os integrantes", async () => {
      await establishmentRepo.insert(buildEstablishment());
      const leader = buildMusician();
      const member = Musician.fake()
        .aMusician()
        .withMusicianId(new MusicianId(MEMBER_ID))
        .withName("Bruno Costa")
        .withStageName(null)
        .withEmail("bruno@exemplo.com")
        .withCpf("71428793860")
        .build();
      await musicianRepo.bulkInsert([leader, member]);

      const band = Band.fake()
        .aBand()
        .withBandId(new BandId(BAND_ID))
        .withName("Trio Maré")
        .withMembers([
          {
            musician_id: new Uuid(MUSICIAN_ID),
            role: "leader",
            status: "accepted",
          },
          {
            musician_id: new Uuid(MEMBER_ID),
            role: "member",
            status: "accepted",
          },
        ] as any)
        .build();
      await bandRepo.insert(band);

      const booking = Booking.create({
        establishment_id: ESTABLISHMENT_ID,
        band_id: BAND_ID,
        start_at: new Date("2026-09-12T00:00:00Z"),
        end_at: new Date("2026-09-12T02:30:00Z"),
        fee: 3000,
      });
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });
      if (!output.issued)
        throw new Error(`não emitiu: ${JSON.stringify(output)}`);

      // Quem responde é uma pessoa: o líder, na qualidade de representante.
      expect(output.contract.contracted.legal_name).toBe("Ana Ribeiro");
      expect(output.contract.contracted.display_name).toBe("Trio Maré");
      expect(output.contract.contracted.representative?.title).toBe(
        "líder da banda",
      );
      // Formação NOMEADA, não por uuid.
      expect(output.contract.variables.contratado_integrantes).toEqual([
        "Ana Ribeiro",
        "Bruno Costa",
      ]);
      expect(output.contract.clauses.map((c) => c.key)).toContain(
        "substituicao_integrantes",
      );
    });
  });

  /**
   * A rota nasceu sem autorização nenhuma: repassava o DTO cru e só filtrava a
   * LEITURA do resultado, quando o contrato alheio já tinha nascido, o PDF já
   * estava no storage e o `ContractIssuedEvent` já tinha mandado o documento —
   * com CPF, CNPJ, endereço e cachê — por e-mail às duas partes. Estes testes
   * travam a ordem: negar antes de qualquer efeito.
   */
  describe("autorização", () => {
    const OUTSIDER_ID = "99999999-9999-4999-8999-999999999999";

    beforeEach(async () => {
      await establishmentRepo.insert(buildEstablishment());
      await musicianRepo.insert(buildMusician());
    });

    it("emite para o estabelecimento do show", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: [ESTABLISHMENT_ID],
      });

      expect(output.issued).toBe(true);
    });

    it("emite para o músico do show", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: [MUSICIAN_ID],
      });

      expect(output.issued).toBe(true);
    });

    it("recusa quem não é parte SEM criar contrato, subir PDF ou emitir evento", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      await expect(
        useCase.execute({
          booking_id: booking.booking_id.id,
          requesting_participant_ids: [OUTSIDER_ID],
        }),
      ).rejects.toThrow(/permissão/i);

      // O ponto do teste não é o 403 — é o que NÃO aconteceu junto dele.
      expect(
        await contractRepo.findCurrentByBookingId(booking.booking_id.id),
      ).toBeNull();
      expect(storage.objects.size).toBe(0);
      expect(renderer.lastContractInput).toBeNull();
    });

    it("recusa antes de revelar a pendência de qualificação", async () => {
      // Estado cadastral alheio (`contratado.cpf`, `contratante.cnpj`) é
      // informação; o ramo `issued: false` não pode virar um oráculo dele.
      await establishmentRepo.delete(new EstablishmentId(ESTABLISHMENT_ID));
      await establishmentRepo.insert(buildEstablishment({ cnpj: null }));
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      await expect(
        useCase.execute({
          booking_id: booking.booking_id.id,
          requesting_participant_ids: [OUTSIDER_ID],
        }),
      ).rejects.toThrow(/permissão/i);
    });

    it("recusa no caminho de idempotência — contrato já emitido não vaza pelo booking_id", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);
      await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      await expect(
        useCase.execute({
          booking_id: booking.booking_id.id,
          requesting_participant_ids: [OUTSIDER_ID],
        }),
      ).rejects.toThrow(/permissão/i);
    });

    it("recusa ator sem identidade utilizável em vez de pular a checagem", async () => {
      // `assertNegotiationViewer` pula sobre lista vazia (convenção dos jobs
      // internos). Aqui isso seria fail-open para todo token sem claim.
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      await expect(
        useCase.execute({
          booking_id: booking.booking_id.id,
          requesting_participant_ids: [],
        }),
      ).rejects.toThrow(/permissão/i);
    });

    it("recusa quando a chave de identidade sequer chega — 403, não 500", async () => {
      // Só o `null` explícito pula. Um chamador que escapasse do `tsc` (js cru,
      // `as any`) tem que tomar 403; um TypeError esconderia a fiação faltando.
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      await expect(
        useCase.execute({ booking_id: booking.booking_id.id } as any),
      ).rejects.toThrow(/permissão/i);
    });

    it("admin emite sem ser parte", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: [OUTSIDER_ID],
        is_admin: true,
      });

      expect(output.issued).toBe(true);
    });

    it("`null` é o caminho do sistema e continua emitindo", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCase.execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });

      expect(output.issued).toBe(true);
    });
  });

  /**
   * O único ponto de contato com o F1.3(a).
   *
   * As cláusulas de custódia já estão escritas e testadas desde o Bloco 10 — a
   * armadilha registrada é que **variante nunca emitida apodrece em silêncio**.
   * Estes testes são o que faz a variante ser exercitada de verdade.
   */
  describe("custódia (escrow)", () => {
    function useCaseComEscrow(
      escrow: { enabled: boolean; custodian_legal_name: string } | null,
    ) {
      return new IssueContractUseCase({
        contractRepo,
        bookingRepo,
        establishmentRepo,
        musicianRepo,
        bandRepo,
        catalog: new ClauseCatalog(),
        renderer,
        storage,
        issuer: { legal_name: "SoundMeet", document: "00000000000191" },
        verificationBaseUrl: "https://soundmeet.com.br/contrato",
        clock: { now: () => NOW },
        escrow,
      });
    }

    beforeEach(async () => {
      await establishmentRepo.insert(buildEstablishment());
      await musicianRepo.insert(buildMusician());
    });

    it("desligado: nenhuma cláusula de custódia e custodiante nulo", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCaseComEscrow(null).execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });
      if (!output.issued) throw new Error("deveria emitir");

      expect(output.contract.variables.custodiante_nome).toBeNull();
      expect(output.contract.clauses.map((c) => c.key)).not.toContain(
        "custodia_liberacao",
      );
    });

    it("ligado: entra a cláusula de liberação e o custodiante vai NOMEADO", async () => {
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCaseComEscrow({
        enabled: true,
        custodian_legal_name: "Asaas Gestão Financeira IP S.A.",
      }).execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });
      if (!output.issued) throw new Error("deveria emitir");

      expect(output.contract.variables.custodiante_nome).toBe(
        "Asaas Gestão Financeira IP S.A.",
      );
      expect(output.contract.clauses.map((c) => c.key)).toContain(
        "custodia_liberacao",
      );
    });

    it("🔴 quem CUSTODIA é a instituição, não a plataforma", async () => {
      /*
       * A cláusula nomeia os DOIS, e isso é correto: a plataforma aparece como
       * plataforma ("registro da apresentação na plataforma X", "independente
       * de ato discricionário da X"), e a instituição de pagamento aparece como
       * custodiante ("permanece em custódia junto a Y").
       *
       * O que não pode acontecer é a plataforma ocupar o papel de custodiante —
       * seria afirmar, no documento que declara o oposto, que o valor está com
       * ela. Por isso a asserção é sobre a FRASE de custódia, não sobre a
       * presença do nome no corpo inteiro.
       */
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCaseComEscrow({
        enabled: true,
        custodian_legal_name: "Asaas Gestão Financeira IP S.A.",
      }).execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });
      if (!output.issued) throw new Error("deveria emitir");

      const custodia = output.contract.clauses.find(
        (c) => c.key === "custodia_liberacao",
      );

      expect(custodia!.body).toContain(
        "permanece em custódia junto a Asaas Gestão Financeira IP S.A.",
      );
      expect(custodia!.body).not.toContain("em custódia junto a SoundMeet");
      expect(output.contract.variables.custodiante_nome).not.toBe("SoundMeet");
    });

    it("ligado SEM custodiante falha para o lado seguro", async () => {
      // Prometer custódia sem dizer onde é papel fraco justamente no ponto em
      // que o valor do documento está.
      const booking = buildBooking();
      await bookingRepo.insert(booking);

      const output = await useCaseComEscrow({
        enabled: true,
        custodian_legal_name: "   ",
      }).execute({
        booking_id: booking.booking_id.id,
        requesting_participant_ids: null,
      });
      if (!output.issued) throw new Error("deveria emitir");

      expect(output.contract.variables.custodiante_nome).toBeNull();
      expect(output.contract.clauses.map((c) => c.key)).not.toContain(
        "custodia_liberacao",
      );
    });
  });
});
