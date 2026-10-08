import { Readable } from "node:stream";

import { ForbiddenException } from "@nestjs/common";

import { Band, BandId } from "../../../../../musician/domain/band.aggregate";
import { BandInMemoryRepository } from "../../../../../musician/infra/db/in-memory/band-in-memory.repository";
import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import { Contract } from "../../../../domain/contract.aggregate";
import { ContractFakeBuilder } from "../../../../domain/contract-fake.builder";
import { ContractInMemoryRepository } from "../../../../infra/db/in-memory/contract-in-memory.repository";
import {
  CacheSignatureChallengeProvider,
  ChallengeStore,
} from "../../../../infra/signature/cache-signature-challenge.provider";
import { InternalContractSignatureProvider } from "../../../../infra/signature/internal-signature.provider";
import {
  IContractRenderer,
  RenderedDocument,
} from "../../../ports/contract-renderer.port";
import { InvalidSignatureChallengeError } from "../../../ports/contract-signature-challenge.port";
import { IContractStorage } from "../../../ports/contract-storage.interface";
import { SignContractUseCase } from "../sign-contract.use-case";

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";
const BAND_ID = "33333333-3333-4333-8333-333333333333";
const LEADER_SUB = "44444444-4444-4444-8444-444444444444";
const MEMBER_SUB = "55555555-5555-4555-8555-555555555555";
const NOW = new Date("2026-08-15T14:00:00Z");

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

class FakeRenderer implements IContractRenderer {
  certificateCalls = 0;

  async renderContract(): Promise<RenderedDocument> {
    return {
      data: Buffer.from("%PDF"),
      content_type: "application/pdf",
      file_extension: "pdf",
    };
  }

  async renderSignatureCertificate(): Promise<RenderedDocument> {
    this.certificateCalls += 1;
    return {
      data: Buffer.from("%PDF-cert"),
      content_type: "application/pdf",
      file_extension: "pdf",
    };
  }
}

class FakeStorage implements IContractStorage {
  objects = new Map<string, unknown>();

  async putObject(input: {
    object_key: string;
    data: Buffer | Readable;
    content_type: string;
  }): Promise<void> {
    this.objects.set(input.object_key, input.data);
  }

  async getObject() {
    return null;
  }

  async deleteObject(input: { object_key: string }): Promise<void> {
    this.objects.delete(input.object_key);
  }
}

describe("SignContractUseCase", () => {
  let contractRepo: ContractInMemoryRepository;
  let bandRepo: BandInMemoryRepository;
  let renderer: FakeRenderer;
  let storage: FakeStorage;
  let challenge: CacheSignatureChallengeProvider;
  let useCase: SignContractUseCase;

  async function seedSoloContract(): Promise<Contract> {
    const contract = ContractFakeBuilder.aContract()
      .withEstablishmentId(ESTABLISHMENT_ID)
      .withMusicianId(MUSICIAN_ID)
      .build();
    await contractRepo.insert(contract);
    return contract;
  }

  async function seedBandContract(): Promise<Contract> {
    const contract = ContractFakeBuilder.aContract()
      .withEstablishmentId(ESTABLISHMENT_ID)
      .withBandId(BAND_ID)
      .build();
    await contractRepo.insert(contract);

    const band = Band.fake()
      .aBand()
      .withBandId(new BandId(BAND_ID))
      .withMembers([
        {
          musician_id: new Uuid(LEADER_SUB),
          role: "leader",
          status: "accepted",
        },
        {
          musician_id: new Uuid(MEMBER_SUB),
          role: "member",
          status: "accepted",
        },
      ] as any)
      .build();
    await bandRepo.insert(band);

    return contract;
  }

  beforeEach(() => {
    contractRepo = new ContractInMemoryRepository();
    bandRepo = new BandInMemoryRepository();
    renderer = new FakeRenderer();
    storage = new FakeStorage();
    challenge = new CacheSignatureChallengeProvider(
      new MapStore(),
      "test-challenge-secret",
    );

    useCase = new SignContractUseCase({
      contractRepo,
      challenge,
      signatureProvider: new InternalContractSignatureProvider({
        now: () => NOW,
      }),
      renderer,
      storage,
      bandRepo,
    });
  });

  /**
   * Emite o código do papel correto e o injeta no input.
   *
   * Os testes abaixo tratam de consentimento, papel e autorização — não do
   * segundo fator. Sem este helper, cada um deles teria três linhas de emissão
   * de OTP obscurecendo o que realmente exercita. O caminho do código errado,
   * expirado e reusado tem suíte própria.
   */
  async function withCode<T extends { contract_id: string }>(
    contract: Contract,
    input: T & {
      requesting_user_id?: string;
      requesting_participant_ids?: string[];
    },
  ): Promise<T & { challenge_code: string }> {
    const ids = input.requesting_participant_ids ?? [];
    const isContracted =
      (!!contract.musician_id && ids.includes(contract.musician_id.id)) ||
      (!!contract.band_id && ids.includes(contract.band_id.id));

    const { code } = await challenge.issue({
      contract_id: contract.contract_id.id,
      role: isContracted ? "contracted" : "contractor",
      signer_user_id: input.requesting_user_id ?? "",
    });

    return { ...input, challenge_code: code };
  }

  /*
   * O provider real, não um mock: assinar é o fluxo que o segundo fator
   * protege, e um mock que sempre aceita transformaria todos os testes abaixo
   * em testes de um mundo onde o OTP não existe.
   */
  async function codeFor(
    contract: Contract,
    role: "contractor" | "contracted",
    signerUserId: string,
  ): Promise<string> {
    const { code } = await challenge.issue({
      contract_id: contract.contract_id.id,
      role,
      signer_user_id: signerUserId,
    });
    return code;
  }

  describe("consentimento", () => {
    it("recusa assinatura sem aceite explícito", async () => {
      const contract = await seedSoloContract();

      await expect(
        useCase.execute(
          await withCode(contract, {
            contract_id: contract.contract_id.id,
            accept_terms: false,
            requesting_user_id: MUSICIAN_ID,
            requesting_participant_ids: [MUSICIAN_ID],
          }),
        ),
      ).rejects.toThrow(EntityValidationError);
    });
  });

  /*
   * O `withCode` acima emite o código certo para os demais testes. Aqui o
   * código é o objeto do teste: é o que impede que um token de sessão roubado,
   * sozinho, assine um contrato.
   */
  describe("segundo fator", () => {
    it("recusa assinatura com código errado", async () => {
      const contract = await seedSoloContract();
      const { code } = await challenge.issue({
        contract_id: contract.contract_id.id,
        role: "contractor",
        signer_user_id: "sub-do-dono",
      });

      await expect(
        useCase.execute({
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: "sub-do-dono",
          requesting_participant_ids: [ESTABLISHMENT_ID],
          challenge_code: code === "000000" ? "111111" : "000000",
        }),
      ).rejects.toThrow(InvalidSignatureChallengeError);

      const salvo = await contractRepo.findById(contract.contract_id);
      expect(salvo!.signatures).toHaveLength(0);
    });

    it("recusa assinatura sem código emitido", async () => {
      const contract = await seedSoloContract();

      await expect(
        useCase.execute({
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: "sub-do-dono",
          requesting_participant_ids: [ESTABLISHMENT_ID],
          challenge_code: "123456",
        }),
      ).rejects.toThrow(InvalidSignatureChallengeError);
    });

    // O código do contratante não assina pelo contratado.
    it("recusa código emitido para o outro papel", async () => {
      const contract = await seedSoloContract();
      const { code } = await challenge.issue({
        contract_id: contract.contract_id.id,
        role: "contractor",
        signer_user_id: MUSICIAN_ID,
      });

      await expect(
        useCase.execute({
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: MUSICIAN_ID,
          requesting_participant_ids: [MUSICIAN_ID],
          challenge_code: code,
        }),
      ).rejects.toThrow(InvalidSignatureChallengeError);
    });

    // Uso único: replay de uma requisição capturada não assina de novo.
    it("não reaproveita o mesmo código numa segunda assinatura", async () => {
      const contract = await seedSoloContract();
      const { code } = await challenge.issue({
        contract_id: contract.contract_id.id,
        role: "contractor",
        signer_user_id: "sub-do-dono",
      });
      const input = {
        contract_id: contract.contract_id.id,
        accept_terms: true,
        requesting_user_id: "sub-do-dono",
        requesting_participant_ids: [ESTABLISHMENT_ID],
        challenge_code: code,
      };

      await useCase.execute(input);

      await expect(useCase.execute(input)).rejects.toThrow(
        InvalidSignatureChallengeError,
      );
    });

    /*
     * A ordem em `SignContractUseCase` é: aceite → autorização → papel →
     * consumo do código → captura da assinatura. Consumir só depois de
     * autorizar impede que um terceiro queime o código da parte legítima.
     */
    it("não consome o código quando o requisitante não é parte", async () => {
      const contract = await seedSoloContract();
      const { code } = await challenge.issue({
        contract_id: contract.contract_id.id,
        role: "contractor",
        signer_user_id: "sub-do-dono",
      });

      await expect(
        useCase.execute({
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: "estranho",
          requesting_participant_ids: ["99999999-9999-4999-8999-999999999999"],
          challenge_code: code,
        }),
      ).rejects.toThrow();

      // O código da parte legítima continua valendo.
      await expect(
        useCase.execute({
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: "sub-do-dono",
          requesting_participant_ids: [ESTABLISHMENT_ID],
          challenge_code: code,
        }),
      ).resolves.toBeDefined();
    });
  });

  describe("papel derivado das identidades", () => {
    it("o estabelecimento assina como CONTRATANTE", async () => {
      const contract = await seedSoloContract();

      const output = await useCase.execute(
        await withCode(contract, {
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: "sub-do-dono",
          requesting_participant_ids: [ESTABLISHMENT_ID],
        }),
      );

      expect(output.status).toBe("partially_signed");
      expect(output.signatures).toHaveLength(1);
      expect(output.signatures[0].role).toBe("contractor");
      expect(output.pending_signatures).toEqual(["contracted"]);
    });

    it("o músico assina como CONTRATADO", async () => {
      const contract = await seedSoloContract();

      const output = await useCase.execute(
        await withCode(contract, {
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: MUSICIAN_ID,
          requesting_participant_ids: [MUSICIAN_ID],
        }),
      );

      expect(output.signatures[0].role).toBe("contracted");
    });

    /**
     * Multi-role existe desde o 4E.14: o músico que também é dono do bar. O
     * lado do CONTRATADO vence porque é o lado com obrigação de fazer — assinar
     * por ele é o ato mais oneroso dos dois.
     */
    it("quando o ator é os dois lados, assina como CONTRATADO", async () => {
      const contract = await seedSoloContract();

      const output = await useCase.execute(
        await withCode(contract, {
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: MUSICIAN_ID,
          requesting_participant_ids: [ESTABLISHMENT_ID, MUSICIAN_ID],
        }),
      );

      expect(output.signatures[0].role).toBe("contracted");
    });
  });

  describe("autorização", () => {
    it("recusa quem não é parte", async () => {
      const contract = await seedSoloContract();

      await expect(
        useCase.execute(
          await withCode(contract, {
            contract_id: contract.contract_id.id,
            accept_terms: true,
            requesting_user_id: "intruso",
            requesting_participant_ids: [
              "99999999-9999-4999-8999-999999999999",
            ],
          }),
        ),
      ).rejects.toThrow(ForbiddenException);

      expect(contractRepo.items[0].signatures).toHaveLength(0);
    });

    /**
     * 🔴 Reúso literal de `assertNegotiationParticipant`: em banda, só o líder
     * decide. Assinar é tão vinculante quanto confirmar um booking, e as duas
     * regras não podem divergir.
     */
    it("em banda, membro comum NÃO assina", async () => {
      const contract = await seedBandContract();

      await expect(
        useCase.execute(
          await withCode(contract, {
            contract_id: contract.contract_id.id,
            accept_terms: true,
            requesting_user_id: MEMBER_SUB,
            requesting_musician_id: MEMBER_SUB,
            requesting_participant_ids: [BAND_ID],
          }),
        ),
      ).rejects.toThrow(/Somente o líder da banda/);
    });

    it("em banda, o líder assina", async () => {
      const contract = await seedBandContract();

      const output = await useCase.execute(
        await withCode(contract, {
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: LEADER_SUB,
          requesting_musician_id: LEADER_SUB,
          requesting_participant_ids: [BAND_ID],
        }),
      );

      expect(output.signatures[0].role).toBe("contracted");
    });
  });

  describe("fechamento", () => {
    it("a segunda assinatura fecha o contrato e gera o certificado", async () => {
      const contract = await seedSoloContract();

      await useCase.execute(
        await withCode(contract, {
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: "sub-do-dono",
          requesting_participant_ids: [ESTABLISHMENT_ID],
        }),
      );

      const output = await useCase.execute(
        await withCode(contract, {
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: MUSICIAN_ID,
          requesting_participant_ids: [MUSICIAN_ID],
        }),
      );

      expect(output.status).toBe("signed");
      expect(output.signed_at).toEqual(NOW);
      expect(output.pending_signatures).toEqual([]);
      expect(output.has_certificate).toBe(true);
      expect(renderer.certificateCalls).toBe(1);
      expect(storage.objects.size).toBe(1);
    });

    it("não gera certificado na primeira assinatura", async () => {
      const contract = await seedSoloContract();

      await useCase.execute(
        await withCode(contract, {
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: MUSICIAN_ID,
          requesting_participant_ids: [MUSICIAN_ID],
        }),
      );

      expect(renderer.certificateCalls).toBe(0);
      expect(storage.objects.size).toBe(0);
    });

    it("recusa a segunda assinatura do mesmo lado", async () => {
      const contract = await seedSoloContract();

      await useCase.execute(
        await withCode(contract, {
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: MUSICIAN_ID,
          requesting_participant_ids: [MUSICIAN_ID],
        }),
      );

      await expect(
        useCase.execute(
          await withCode(contract, {
            contract_id: contract.contract_id.id,
            accept_terms: true,
            requesting_user_id: MUSICIAN_ID,
            requesting_participant_ids: [MUSICIAN_ID],
          }),
        ),
      ).rejects.toThrow(EntityValidationError);
    });
  });

  describe("trilha de auditoria", () => {
    it("registra IP direto quando não há proxy", async () => {
      const contract = await seedSoloContract();

      const output = await useCase.execute(
        await withCode(contract, {
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: MUSICIAN_ID,
          requesting_participant_ids: [MUSICIAN_ID],
          observed_ip: "203.0.113.42",
          user_agent: "SoundMeet/1.0 (Android)",
        }),
      );

      expect(output.signatures[0]).toMatchObject({
        ip: "203.0.113.42",
        ip_source: "direct",
        forwarded_for: null,
        user_agent: "SoundMeet/1.0 (Android)",
        method: "platform_acceptance",
      });
    });

    /**
     * 🔴 Todo o soundmeet-web sai de um IP só. A trilha precisa dizer que o IP
     * é do BFF, não do signatário — evidência que exagera é evidência que o
     * outro lado derruba.
     */
    it("marca o IP como `proxied` quando há X-Forwarded-For", async () => {
      const contract = await seedSoloContract();

      const output = await useCase.execute(
        await withCode(contract, {
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: "sub-do-dono",
          requesting_participant_ids: [ESTABLISHMENT_ID],
          observed_ip: "10.0.0.5",
          forwarded_for: "203.0.113.7, 10.0.0.5",
        }),
      );

      expect(output.signatures[0]).toMatchObject({
        ip: "10.0.0.5",
        ip_source: "proxied",
        forwarded_for: "203.0.113.7, 10.0.0.5",
      });
    });

    it("marca como `unknown` quando não há IP nenhum", async () => {
      const contract = await seedSoloContract();

      const output = await useCase.execute(
        await withCode(contract, {
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: MUSICIAN_ID,
          requesting_participant_ids: [MUSICIAN_ID],
          observed_ip: null,
        }),
      );

      expect(output.signatures[0].ip_source).toBe("unknown");
    });

    it("copia nome e e-mail da parte congelada, e liga à conta autenticada", async () => {
      const contract = await seedSoloContract();

      const output = await useCase.execute(
        await withCode(contract, {
          contract_id: contract.contract_id.id,
          accept_terms: true,
          requesting_user_id: "sub-autenticado-123",
          requesting_participant_ids: [MUSICIAN_ID],
        }),
      );

      expect(output.signatures[0].signer_name).toBe(
        contract.contracted.legal_name,
      );
      expect(output.signatures[0].signer_email).toBe(contract.contracted.email);
      expect(output.signatures[0].signer_user_id).toBe("sub-autenticado-123");
    });
  });
});
