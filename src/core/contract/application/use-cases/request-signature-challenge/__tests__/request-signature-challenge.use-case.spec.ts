import { ForbiddenException } from "@nestjs/common";

import { EntityValidationError } from "../../../../../shared/domain/validators/validation.error";
import { Contract } from "../../../../domain/contract.aggregate";
import { ContractFakeBuilder } from "../../../../domain/contract-fake.builder";
import { ContractInMemoryRepository } from "../../../../infra/db/in-memory/contract-in-memory.repository";
import {
  CacheSignatureChallengeProvider,
  ChallengeStore,
} from "../../../../infra/signature/cache-signature-challenge.provider";
import {
  IContractChallengeNotifier,
  SignatureChallengeNotification,
} from "../../../ports/contract-challenge-notifier.port";
import {
  maskEmail,
  RequestSignatureChallengeUseCase,
} from "../request-signature-challenge.use-case";

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

class RecordingNotifier implements IContractChallengeNotifier {
  sent: SignatureChallengeNotification[] = [];

  async sendSignatureChallenge(
    input: SignatureChallengeNotification,
  ): Promise<void> {
    this.sent.push(input);
  }
}

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";

describe("RequestSignatureChallengeUseCase", () => {
  let contractRepo: ContractInMemoryRepository;
  let challenge: CacheSignatureChallengeProvider;
  let notifier: RecordingNotifier;
  let useCase: RequestSignatureChallengeUseCase;

  async function seedContract(): Promise<Contract> {
    const contract = ContractFakeBuilder.aContract()
      .withEstablishmentId(ESTABLISHMENT_ID)
      .withMusicianId(MUSICIAN_ID)
      .build();
    await contractRepo.insert(contract);
    return contract;
  }

  beforeEach(() => {
    contractRepo = new ContractInMemoryRepository();
    challenge = new CacheSignatureChallengeProvider(
      new MapStore(),
      "test-challenge-secret",
    );
    notifier = new RecordingNotifier();
    useCase = new RequestSignatureChallengeUseCase({
      contractRepo,
      challenge,
      notifier,
    });
  });

  it("envia o código ao e-mail congelado da parte e devolve o destino mascarado", async () => {
    const contract = await seedContract();

    const output = await useCase.execute({
      contract_id: contract.contract_id.id,
      requesting_user_id: MUSICIAN_ID,
      requesting_participant_ids: [MUSICIAN_ID],
    });

    expect(output.role).toBe("contracted");
    expect(notifier.sent).toHaveLength(1);
    expect(notifier.sent[0].to).toBe(contract.contracted.email);
    expect(output.destination_masked).toBe(
      maskEmail(contract.contracted.email),
    );
  });

  /*
   * 🔴 O teste mais importante desta suíte. Devolver o código na resposta HTTP
   * anularia o segundo fator: quem já tem o token da conta o leria ali mesmo, e
   * a medida viraria teatro.
   */
  it("NUNCA devolve o código no output", async () => {
    const contract = await seedContract();

    const output = await useCase.execute({
      contract_id: contract.contract_id.id,
      requesting_user_id: MUSICIAN_ID,
      requesting_participant_ids: [MUSICIAN_ID],
    });

    const enviado = notifier.sent[0].code;
    expect(JSON.stringify(output)).not.toContain(enviado);
    expect(output).not.toHaveProperty("code");
  });

  it("emite para o CONTRATANTE quando quem pede é o estabelecimento", async () => {
    const contract = await seedContract();

    const output = await useCase.execute({
      contract_id: contract.contract_id.id,
      requesting_user_id: "sub-do-dono",
      requesting_participant_ids: [ESTABLISHMENT_ID],
    });

    expect(output.role).toBe("contractor");
    expect(notifier.sent[0].to).toBe(contract.contractor.email);
  });

  it("recusa quem não é parte", async () => {
    const contract = await seedContract();

    await expect(
      useCase.execute({
        contract_id: contract.contract_id.id,
        requesting_user_id: "estranho",
        requesting_participant_ids: ["99999999-9999-4999-8999-999999999999"],
      }),
    ).rejects.toThrow(ForbiddenException);

    expect(notifier.sent).toHaveLength(0);
  });

  // Sem isto, um contrato já assinado ainda dispararia e-mail com código vivo.
  it("recusa quando a parte já assinou", async () => {
    const contract = await seedContract();
    contract.sign({
      role: "contracted",
      signer_user_id: MUSICIAN_ID,
      signed_at: new Date(),
      ip: null,
      ip_source: "unknown",
      forwarded_for: null,
      user_agent: null,
    });
    await contractRepo.update(contract);

    await expect(
      useCase.execute({
        contract_id: contract.contract_id.id,
        requesting_user_id: MUSICIAN_ID,
        requesting_participant_ids: [MUSICIAN_ID],
      }),
    ).rejects.toThrow(EntityValidationError);

    expect(notifier.sent).toHaveLength(0);
  });

  describe("maskEmail", () => {
    it("preserva o domínio e esconde a parte local", () => {
      expect(maskEmail("ana.ribeiro@exemplo.com")).toBe(
        "a**********@exemplo.com",
      );
    });

    it("não quebra com entrada malformada", () => {
      expect(maskEmail("sem-arroba")).toBe("***");
    });
  });
});
