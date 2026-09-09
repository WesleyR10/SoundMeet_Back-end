import { Readable } from "node:stream";

import { Test } from "@nestjs/testing";

import {
  IContractChallengeNotifier,
  SignatureChallengeNotification,
} from "../../../core/contract/application/ports/contract-challenge-notifier.port";
import {
  ContractDocumentNotification,
  IContractDocumentNotifier,
} from "../../../core/contract/application/ports/contract-document-notifier.port";
import { IContractRenderer } from "../../../core/contract/application/ports/contract-renderer.port";
import { IContractStorage } from "../../../core/contract/application/ports/contract-storage.interface";
import { AnnulContractUseCase } from "../../../core/contract/application/use-cases/annul-contract/annul-contract.use-case";
import { GetContractUseCase } from "../../../core/contract/application/use-cases/get-contract/get-contract.use-case";
import { GetContractDocumentUseCase } from "../../../core/contract/application/use-cases/get-contract-document/get-contract-document.use-case";
import { IssueContractUseCase } from "../../../core/contract/application/use-cases/issue-contract/issue-contract.use-case";
import { ListContractsUseCase } from "../../../core/contract/application/use-cases/list-contracts/list-contracts.use-case";
import { NotifyContractPartiesUseCase } from "../../../core/contract/application/use-cases/notify-contract-parties/notify-contract-parties.use-case";
import { RequestSignatureChallengeUseCase } from "../../../core/contract/application/use-cases/request-signature-challenge/request-signature-challenge.use-case";
import { SignContractUseCase } from "../../../core/contract/application/use-cases/sign-contract/sign-contract.use-case";
import { VerifyContractUseCase } from "../../../core/contract/application/use-cases/verify-contract/verify-contract.use-case";
import { ContractFakeBuilder } from "../../../core/contract/domain/contract-fake.builder";
import { ContractInMemoryRepository } from "../../../core/contract/infra/db/in-memory/contract-in-memory.repository";
import {
  CacheSignatureChallengeProvider,
  ChallengeStore,
} from "../../../core/contract/infra/signature/cache-signature-challenge.provider";
import { InternalContractSignatureProvider } from "../../../core/contract/infra/signature/internal-signature.provider";
import { BandInMemoryRepository } from "../../../core/musician/infra/db/in-memory/band-in-memory.repository";
import { AuthenticatedUser } from "../../auth-module/interfaces/authenticated-user.interface";
import { applyAuthGuardMocks } from "../../shared-module/testing/auth-guard-mock";
import { ContractVerificationController } from "../contract-verification.controller";
import { ContractsController } from "../contracts.controller";

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const OUTSIDER_ID = "99999999-9999-4999-8999-999999999999";

function userAs(overrides: Partial<AuthenticatedUser>): AuthenticatedUser {
  return {
    userId: MUSICIAN_ID,
    roles: ["musician"],
    establishmentIds: [],
    bandIds: [],
    ...overrides,
  } as AuthenticatedUser;
}

const fakeRenderer: IContractRenderer = {
  async renderContract() {
    return {
      data: Buffer.from("%PDF"),
      content_type: "application/pdf",
      file_extension: "pdf",
    };
  },
  async renderSignatureCertificate() {
    return {
      data: Buffer.from("%PDF"),
      content_type: "application/pdf",
      file_extension: "pdf",
    };
  },
};

const PDF = Buffer.from("%PDF-1.7 conteudo do contrato");

/**
 * Devolve `null` por padrão — é o estado do contrato recém-emitido nos demais
 * testes, e o que faz `has_document` ser `false`. Os testes de reenvio ligam o
 * conteúdo explicitamente.
 */
class FakeStorage implements IContractStorage {
  hasObject = false;

  async putObject(): Promise<void> {}
  async deleteObject(): Promise<void> {}
  async getObject() {
    if (!this.hasObject) return null;
    return {
      data: Readable.from([PDF]),
      content_type: "application/pdf",
      content_length: PDF.length,
    };
  }
}

const fakeStorage = new FakeStorage();

/** Store de memória com a superfície mínima que o provider usa. */
class MapStore implements ChallengeStore {
  private readonly map = new Map<string, unknown>();
  async get<T>(key: string): Promise<T | undefined> {
    return this.map.get(key) as T | undefined;
  }
  async set(key: string, value: unknown): Promise<unknown> {
    this.map.set(key, value);
    return value;
  }
  async del(key: string): Promise<unknown> {
    return this.map.delete(key);
  }
}

class RecordingDocumentNotifier implements IContractDocumentNotifier {
  sent: ContractDocumentNotification[] = [];
  failFor: string | null = null;

  async sendContractDocument(
    input: ContractDocumentNotification,
  ): Promise<void> {
    if (this.failFor && input.role === this.failFor) {
      throw new Error("smtp recusou");
    }
    this.sent.push(input);
  }
}

/**
 * Duplê que grava o input recebido pelo `IssueContractUseCase`.
 *
 * Devolve `issued: false` por padrão porque é o ramo que o controller responde
 * sem consultar o `GetContract` — o caminho curto, e o que vazava estado
 * cadastral alheio antes da autorização entrar.
 */
class RecordingIssueUseCase {
  calls: {
    booking_id: string;
    requesting_participant_ids: string[] | null;
    is_admin?: boolean;
  }[] = [];
  next: unknown = { issued: false, missing: ["contratante.cnpj"] };

  async execute(input: {
    booking_id: string;
    requesting_participant_ids: string[] | null;
    is_admin?: boolean;
  }): Promise<any> {
    this.calls.push(input);
    return this.next;
  }
}

class RecordingNotifier implements IContractChallengeNotifier {
  sent: SignatureChallengeNotification[] = [];
  async sendSignatureChallenge(
    input: SignatureChallengeNotification,
  ): Promise<void> {
    this.sent.push(input);
  }
}

describe("ContractsController Integration Tests", () => {
  let controller: ContractsController;
  let verificationController: ContractVerificationController;
  let repository: ContractInMemoryRepository;
  let challenge: CacheSignatureChallengeProvider;
  let notifier: RecordingNotifier;
  let documentNotifier: RecordingDocumentNotifier;
  let issueSpy: RecordingIssueUseCase;

  beforeEach(async () => {
    issueSpy = new RecordingIssueUseCase();
    repository = new ContractInMemoryRepository();
    const bandRepo = new BandInMemoryRepository();
    challenge = new CacheSignatureChallengeProvider(
      new MapStore(),
      "test-challenge-secret",
    );
    notifier = new RecordingNotifier();
    documentNotifier = new RecordingDocumentNotifier();
    fakeStorage.hasObject = false;

    const builder = Test.createTestingModule({
      controllers: [ContractsController, ContractVerificationController],
      providers: [
        { provide: "ContractRepository", useValue: repository },
        {
          provide: ListContractsUseCase,
          useFactory: () => new ListContractsUseCase(repository),
        },
        {
          provide: GetContractUseCase,
          useFactory: () => new GetContractUseCase(repository),
        },
        {
          provide: VerifyContractUseCase,
          useFactory: () => new VerifyContractUseCase(repository),
        },
        {
          provide: GetContractDocumentUseCase,
          useFactory: () =>
            new GetContractDocumentUseCase(repository, fakeStorage),
        },
        {
          provide: SignContractUseCase,
          useFactory: () =>
            new SignContractUseCase({
              contractRepo: repository,
              challenge,
              signatureProvider: new InternalContractSignatureProvider(),
              renderer: fakeRenderer,
              storage: fakeStorage,
              bandRepo,
            }),
        },
        {
          provide: NotifyContractPartiesUseCase,
          useFactory: () =>
            new NotifyContractPartiesUseCase({
              contractRepo: repository,
              storage: fakeStorage,
              notifier: documentNotifier,
              bandRepo,
              verificationBaseUrl: "https://soundmeet.com.br/contrato",
            }),
        },
        {
          provide: RequestSignatureChallengeUseCase,
          useFactory: () =>
            new RequestSignatureChallengeUseCase({
              contractRepo: repository,
              challenge,
              notifier,
              bandRepo,
            }),
        },
        /*
         * O Issue entra como duplê de GRAVAÇÃO, não como `{}`.
         *
         * O que importa provar aqui é a fronteira, não a emissão: que o
         * controller repassa as identidades do TOKEN ao use case. Essa rota já
         * foi a única do módulo sem autorização nenhuma — repassava o DTO cru —
         * e um `{}` como duplê é exatamente o que deixou isso passar despercebido.
         * A autorização em si é exercitada em `issue-contract.use-case.spec.ts`,
         * com repositórios de verdade.
         */
        { provide: IssueContractUseCase, useValue: issueSpy },
        {
          provide: AnnulContractUseCase,
          useFactory: () => new AnnulContractUseCase(repository),
        },
      ],
    });

    const module = await applyAuthGuardMocks(builder as any).compile();

    controller = module.get(ContractsController);
    verificationController = module.get(ContractVerificationController);
  });

  async function seed() {
    const contract = ContractFakeBuilder.aContract()
      .withEstablishmentId(ESTABLISHMENT_ID)
      .withMusicianId(MUSICIAN_ID)
      .withVerificationCode("SM7K2Q9XPT")
      .build();
    await repository.insert(contract);
    return contract;
  }

  /** Contrato já com PDF no storage — estado depois da emissão. */
  async function seedWithDocument() {
    const contract = ContractFakeBuilder.aContract()
      .withEstablishmentId(ESTABLISHMENT_ID)
      .withMusicianId(MUSICIAN_ID)
      .withVerificationCode("SM7K2Q9XPT")
      .withDocumentKey("contracts/abc.pdf")
      .build();
    await repository.insert(contract);
    fakeStorage.hasObject = true;
    return contract;
  }

  /**
   * Pede o código pela rota real e o lê no notificador.
   *
   * Atravessar a rota em vez de chamar `challenge.issue` direto é o ponto: é
   * assim que o cliente faz, e é o que prova que a rota emite para o papel
   * certo. Se a derivação de papel divergir entre emitir e assinar, estes
   * testes quebram — que é exatamente a regressão que `resolveSigningRole`
   * existe para impedir.
   */
  async function codeViaRoute(
    contract: { contract_id: { id: string } },
    user: Partial<AuthenticatedUser>,
  ): Promise<string> {
    const antes = notifier.sent.length;
    await controller.requestSignatureChallenge(
      contract.contract_id.id,
      userAs(user),
    );
    return notifier.sent[antes].code;
  }

  describe("GET /contracts", () => {
    it("escopa pelo token e não vaza contrato alheio", async () => {
      await seed();
      const alheio = ContractFakeBuilder.aContract()
        .withEstablishmentId(OUTSIDER_ID)
        .withMusicianId(OUTSIDER_ID)
        .withVerificationCode("OUTROCODE1")
        .build();
      await repository.insert(alheio);

      const result = await controller.search(
        {},
        userAs({ userId: MUSICIAN_ID }),
      );

      expect(result.data).toHaveLength(1);
      expect(result.data[0].musician_id).toBe(MUSICIAN_ID);
    });

    /**
     * 🔴 Fail-closed. Ator sem nenhuma identidade utilizável precisa receber
     * 403, jamais a lista inteira — o vazamento que já aconteceu em
     * `repertoire`, `transaction` e `musician-wallet`.
     */
    it("recusa ator sem identidade utilizável", async () => {
      await seed();

      await expect(
        controller.search({}, userAs({ userId: "" as any })),
      ).rejects.toThrow(/identificar/);
    });
  });

  describe("GET /contracts/:contract_id", () => {
    it("devolve o snapshot para quem é parte", async () => {
      const contract = await seed();

      const result = await controller.findOne(
        contract.contract_id.id,
        userAs({ userId: MUSICIAN_ID }),
      );

      expect(result.id).toBe(contract.contract_id.id);
      expect(result.clauses.length).toBeGreaterThan(15);
      expect(result.content_hash).toBe(contract.content_hash);
    });

    it("recusa quem não é parte", async () => {
      const contract = await seed();

      await expect(
        controller.findOne(
          contract.contract_id.id,
          userAs({ userId: OUTSIDER_ID }),
        ),
      ).rejects.toThrow(/permissão/);
    });

    /**
     * ⚠️ As chaves do storage privado nunca saem no presenter — expor a chave
     * transformaria a rota autorizada de download em teatro.
     */
    it("NÃO expõe as chaves de storage", async () => {
      const contract = await seed();

      const result: any = await controller.findOne(
        contract.contract_id.id,
        userAs({ userId: MUSICIAN_ID }),
      );

      expect(result.document_key).toBeUndefined();
      expect(result.certificate_key).toBeUndefined();
      expect(result.has_document).toBe(false);
    });
  });

  describe("POST /contracts/:contract_id/document/send", () => {
    /*
     * 🔴 A garantia da rota: reenviar manda a cópia SÓ para quem pediu. Sem
     * isso, um lado dispararia e-mail para a caixa do outro — que não pediu
     * nada.
     */
    it("reenvia somente para o lado de quem pediu", async () => {
      const contract = await seedWithDocument();

      const result = await controller.resendDocument(
        contract.contract_id.id,
        userAs({ userId: MUSICIAN_ID }),
      );

      expect(result.delivered).toEqual(["contracted"]);
      expect(documentNotifier.sent).toHaveLength(1);
      expect(documentNotifier.sent[0].to).toBe(contract.contracted.email);
    });

    it("recusa quem não é parte", async () => {
      const contract = await seed();

      await expect(
        controller.resendDocument(
          contract.contract_id.id,
          userAs({ userId: OUTSIDER_ID, establishmentIds: [OUTSIDER_ID] }),
        ),
      ).rejects.toThrow();

      expect(documentNotifier.sent).toHaveLength(0);
    });

    // Falha de envio é relatada com o papel, não com a caixa de e-mail.
    it("relata a falha sem derrubar a requisição", async () => {
      const contract = await seedWithDocument();
      documentNotifier.failFor = "contracted";

      const result = await controller.resendDocument(
        contract.contract_id.id,
        userAs({ userId: MUSICIAN_ID }),
      );

      expect(result.delivered).toEqual([]);
      expect(result.failed[0].role).toBe("contracted");
      expect(JSON.stringify(result)).not.toContain(contract.contracted.email);
    });
  });

  describe("POST /contracts/:contract_id/sign/challenge", () => {
    it("emite para o papel derivado do token e devolve o destino mascarado", async () => {
      const contract = await seed();

      const result = await controller.requestSignatureChallenge(
        contract.contract_id.id,
        userAs({ userId: MUSICIAN_ID }),
      );

      expect(result.role).toBe("contracted");
      expect(result.destination_masked).toContain("@");
      expect(notifier.sent).toHaveLength(1);
      expect(notifier.sent[0].to).toBe(contract.contracted.email);
    });

    /*
     * 🔴 A garantia central do segundo fator. Se o código vazar na resposta,
     * quem tem o token da conta o lê ali mesmo e a medida vira teatro. O
     * presenter é allowlist justamente para que incluí-lo exija uma linha
     * deliberada.
     */
    it("NUNCA devolve o código na resposta HTTP", async () => {
      const contract = await seed();

      const result = await controller.requestSignatureChallenge(
        contract.contract_id.id,
        userAs({ userId: MUSICIAN_ID }),
      );

      expect(JSON.stringify(result)).not.toContain(notifier.sent[0].code);
    });

    it("recusa quem não é parte", async () => {
      const contract = await seed();

      await expect(
        controller.requestSignatureChallenge(
          contract.contract_id.id,
          userAs({ userId: OUTSIDER_ID, establishmentIds: [OUTSIDER_ID] }),
        ),
      ).rejects.toThrow();

      expect(notifier.sent).toHaveLength(0);
    });
  });

  describe("POST /contracts/:contract_id/sign", () => {
    it("assina com o papel derivado do token e registra a trilha", async () => {
      const contract = await seed();

      const result = await controller.sign(
        contract.contract_id.id,
        {
          accept_terms: true,
          challenge_code: await codeViaRoute(contract, {
            userId: MUSICIAN_ID,
          }),
        },
        userAs({ userId: MUSICIAN_ID }),
        "203.0.113.42",
        undefined,
        "SoundMeet/1.0",
      );

      expect(result.status).toBe("partially_signed");
      expect(result.signatures[0].role).toBe("contracted");
      expect(result.signatures[0].ip).toBe("203.0.113.42");
      expect(result.signatures[0].ip_source).toBe("direct");
      expect(result.signatures[0].user_agent).toBe("SoundMeet/1.0");
    });

    it("marca a procedência quando a requisição vem do BFF", async () => {
      const contract = await seed();

      const dono = {
        userId: "sub-do-dono",
        roles: ["establishment"],
        establishmentIds: [ESTABLISHMENT_ID],
      };
      const result = await controller.sign(
        contract.contract_id.id,
        {
          accept_terms: true,
          challenge_code: await codeViaRoute(contract, dono),
        },
        userAs(dono),
        "10.0.0.5",
        "203.0.113.7, 10.0.0.5",
        "Mozilla/5.0",
      );

      expect(result.signatures[0].role).toBe("contractor");
      expect(result.signatures[0].ip_source).toBe("proxied");
      expect(result.signatures[0].forwarded_for).toBe("203.0.113.7, 10.0.0.5");
    });

    it("recusa sem aceite explícito", async () => {
      const contract = await seed();

      await expect(
        controller.sign(
          contract.contract_id.id,
          { accept_terms: false, challenge_code: "000000" },
          userAs({ userId: MUSICIAN_ID }),
          "203.0.113.42",
          undefined,
          undefined,
        ),
      ).rejects.toThrow();
    });
  });

  describe("GET /contracts/verify/:code (público)", () => {
    it("devolve payload mínimo com nomes mascarados", async () => {
      await seed();

      const result = await verificationController.verify("SM7K2Q9XPT");

      expect(result.verification_code).toBe("SM7K2Q9XPT");
      expect(result.status).toBe("issued");
      expect(result.content_hash).toMatch(/^[a-f0-9]{64}$/);
      // "Ana Ribeiro" → "Ana R."; "Bar do Zé" → "Bar do Z."
      expect(result.contracted_name).toBe("Ana R.");
      expect(result.contractor_name).toBe("Bar do Z.");
      // Nada de cláusula, valor, documento ou endereço.
      expect((result as any).clauses).toBeUndefined();
      expect((result as any).variables).toBeUndefined();
      expect((result as any).contractor).toBeUndefined();
    });

    it("aceita código em minúsculas", async () => {
      await seed();

      const result = await verificationController.verify("sm7k2q9xpt");

      expect(result.verification_code).toBe("SM7K2Q9XPT");
    });

    it("404 para código desconhecido", async () => {
      await expect(verificationController.verify("NAOEXISTE1")).rejects.toThrow(
        /Not Found/i,
      );
    });
  });

  /**
   * As duas rotas que o `contract-digital.md` §10 dizia estarem cobertas e não
   * estavam — e a que faltava era justamente a que não tinha autorização.
   */
  describe("POST /contracts/issue", () => {
    const BOOKING_ID = "44444444-4444-4444-8444-444444444444";

    it("repassa as identidades do TOKEN, nunca as do corpo", async () => {
      await controller.issue(
        { booking_id: BOOKING_ID } as any,
        userAs({ userId: MUSICIAN_ID }),
      );

      expect(issueSpy.calls).toHaveLength(1);
      expect(issueSpy.calls[0].requesting_participant_ids).toEqual([
        MUSICIAN_ID,
      ]);
      expect(issueSpy.calls[0].is_admin).toBe(false);
    });

    it("soma os claims de estabelecimento e banda ao sub", async () => {
      await controller.issue(
        { booking_id: BOOKING_ID } as any,
        userAs({
          userId: MUSICIAN_ID,
          establishmentIds: [ESTABLISHMENT_ID],
          bandIds: ["55555555-5555-4555-8555-555555555555"],
        }),
      );

      expect(issueSpy.calls[0].requesting_participant_ids).toEqual([
        MUSICIAN_ID,
        ESTABLISHMENT_ID,
        "55555555-5555-4555-8555-555555555555",
      ]);
    });

    it("nunca manda `null` — o caminho do sistema não é alcançável por HTTP", async () => {
      await controller.issue(
        { booking_id: BOOKING_ID } as any,
        userAs({ userId: MUSICIAN_ID }),
      );

      // `null` pula a autorização dentro do use case. Se a rota conseguisse
      // produzi-lo, a correção inteira seria contornável pelo corpo.
      expect(issueSpy.calls[0].requesting_participant_ids).not.toBeNull();
    });

    it("marca is_admin para o papel de admin", async () => {
      await controller.issue(
        { booking_id: BOOKING_ID } as any,
        userAs({ userId: MUSICIAN_ID, roles: ["admin"] }),
      );

      expect(issueSpy.calls[0].is_admin).toBe(true);
    });

    it("devolve a pendência sem tocar o contrato quando falta qualificação", async () => {
      const result = await controller.issue(
        { booking_id: BOOKING_ID } as any,
        userAs({ userId: MUSICIAN_ID }),
      );

      expect(result).toEqual({
        issued: false,
        missing: ["contratante.cnpj"],
      });
    });
  });

  describe("POST /contracts/:contract_id/annul", () => {
    it("anula contrato ainda não assinado e registra o motivo", async () => {
      const contract = await seed();

      const result = await controller.annul(contract.contract_id.id, {
        reason: "cachê digitado errado no booking",
      });

      expect(result.status).toBe("annulled");
      const reloaded = await repository.findById(contract.contract_id);
      expect(reloaded!.status).toBe("annulled");
    });

    it("recusa anular contrato ASSINADO — a prova não se apaga", async () => {
      const contract = ContractFakeBuilder.aContract()
        .withEstablishmentId(ESTABLISHMENT_ID)
        .withMusicianId(MUSICIAN_ID)
        .build();
      for (const role of ["contractor", "contracted"] as const) {
        contract.sign({
          role,
          signer_user_id: MUSICIAN_ID,
          signed_at: new Date("2026-08-16T10:00:00Z"),
          ip: "203.0.113.10",
          ip_source: "direct",
          forwarded_for: null,
          user_agent: "jest",
        });
      }
      expect(contract.isFullySigned).toBe(true);
      await repository.insert(contract);

      await expect(
        controller.annul(contract.contract_id.id, { reason: "arrependi" }),
      ).rejects.toThrow();
    });

    it("404 para contrato inexistente", async () => {
      await expect(
        controller.annul("66666666-6666-4666-8666-666666666666", {
          reason: "qualquer",
        }),
      ).rejects.toThrow(/Not Found/i);
    });
  });
});
