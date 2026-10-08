import { Readable } from "node:stream";

import { ForbiddenException } from "@nestjs/common";

import { Contract } from "../../../../domain/contract.aggregate";
import { ContractFakeBuilder } from "../../../../domain/contract-fake.builder";
import { ContractInMemoryRepository } from "../../../../infra/db/in-memory/contract-in-memory.repository";
import {
  ContractDocumentNotification,
  IContractDocumentNotifier,
} from "../../../ports/contract-document-notifier.port";
import { IContractStorage } from "../../../ports/contract-storage.interface";
import { NotifyContractPartiesUseCase } from "../notify-contract-parties.use-case";

const PDF = Buffer.from("%PDF-1.7 conteudo do contrato");

class FakeStorage implements IContractStorage {
  hasObject = true;

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

class RecordingNotifier implements IContractDocumentNotifier {
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

const ESTABLISHMENT_ID = "11111111-1111-4111-8111-111111111111";
const MUSICIAN_ID = "22222222-2222-4222-8222-222222222222";

describe("NotifyContractPartiesUseCase", () => {
  let contractRepo: ContractInMemoryRepository;
  let storage: FakeStorage;
  let notifier: RecordingNotifier;
  let useCase: NotifyContractPartiesUseCase;

  async function seed(): Promise<Contract> {
    const contract = ContractFakeBuilder.aContract()
      .withEstablishmentId(ESTABLISHMENT_ID)
      .withMusicianId(MUSICIAN_ID)
      .withVerificationCode("SM7K2Q9XPT")
      .withDocumentKey("contracts/abc.pdf")
      .build();
    await contractRepo.insert(contract);
    return contract;
  }

  beforeEach(() => {
    contractRepo = new ContractInMemoryRepository();
    storage = new FakeStorage();
    notifier = new RecordingNotifier();
    useCase = new NotifyContractPartiesUseCase({
      contractRepo,
      storage,
      notifier,
      verificationBaseUrl: "https://soundmeet.com.br/contrato",
    });
  });

  describe("entrega automática", () => {
    it("envia para as duas partes, com o PDF anexo", async () => {
      const contract = await seed();

      const output = await useCase.execute({
        contract_id: contract.contract_id.id,
        moment: "issued",
      });

      expect(output.delivered).toEqual(["contractor", "contracted"]);
      expect(output.failed).toEqual([]);
      expect(notifier.sent).toHaveLength(2);
      expect(notifier.sent[0].document.content).toEqual(PDF);
      expect(notifier.sent[0].document.filename).toBe(
        "contrato-SM7K2Q9XPT.pdf",
      );
    });

    /*
     * O hash no corpo do e-mail é o ponto da entrega: hash impresso apenas
     * dentro do PDF prova pouco, porque se o arquivo foi adulterado o hash foi
     * junto. Na caixa da parte, ele fica fora do nosso alcance.
     */
    it("leva o hash e a URL de verificação a cada parte", async () => {
      const contract = await seed();

      await useCase.execute({
        contract_id: contract.contract_id.id,
        moment: "issued",
      });

      for (const enviado of notifier.sent) {
        expect(enviado.content_hash).toBe(contract.content_hash);
        expect(enviado.verification_url).toBe(
          "https://soundmeet.com.br/contrato/SM7K2Q9XPT",
        );
      }
    });

    it("manda a cópia para o e-mail congelado de cada parte", async () => {
      const contract = await seed();

      await useCase.execute({
        contract_id: contract.contract_id.id,
        moment: "issued",
      });

      const destinos = notifier.sent.map((e) => e.to);
      expect(destinos).toEqual([
        contract.contractor.email,
        contract.contracted.email,
      ]);
    });

    // Cada um recebe o nome do outro, não o próprio.
    it("identifica a contraparte de cada lado", async () => {
      const contract = await seed();

      await useCase.execute({
        contract_id: contract.contract_id.id,
        moment: "signed",
      });

      const paraContratante = notifier.sent.find(
        (e) => e.role === "contractor",
      )!;
      expect(paraContratante.counterparty_name).toBe(
        contract.contracted.display_name || contract.contracted.legal_name,
      );
    });
  });

  describe("falha de entrega", () => {
    /*
     * Perder as duas cópias porque o servidor da primeira recusou seria pior
     * que perder uma. As entregas são independentes.
     */
    it("uma parte falhar não impede a outra", async () => {
      const contract = await seed();
      notifier.failFor = "contractor";

      const output = await useCase.execute({
        contract_id: contract.contract_id.id,
        moment: "issued",
      });

      expect(output.delivered).toEqual(["contracted"]);
      expect(output.failed).toEqual([
        { role: "contractor", reason: "smtp recusou" },
      ]);
    });

    // Relata, não lança: o contrato já está persistido quando chega aqui.
    it("relata a falha em vez de lançar", async () => {
      const contract = await seed();
      notifier.failFor = "contractor";

      await expect(
        useCase.execute({
          contract_id: contract.contract_id.id,
          moment: "issued",
        }),
      ).resolves.toBeDefined();
    });

    it("sinaliza documento ausente no storage sem enviar nada", async () => {
      const contract = await seed();
      storage.hasObject = false;

      const output = await useCase.execute({
        contract_id: contract.contract_id.id,
        moment: "issued",
      });

      expect(output.document_available).toBe(false);
      expect(notifier.sent).toHaveLength(0);
    });
  });

  describe("reenvio pedido por uma parte", () => {
    /*
     * 🔴 O reenvio manda a cópia SÓ para quem pediu. Sem o `only_role` derivado
     * do agregado, a rota mandaria também para a outra parte — que não pediu
     * nada e cujo e-mail o requisitante passaria a saber que existe.
     */
    it("envia somente para o lado de quem pediu", async () => {
      const contract = await seed();

      const output = await useCase.execute({
        contract_id: contract.contract_id.id,
        requesting_participant_ids: [MUSICIAN_ID],
        requesting_musician_id: MUSICIAN_ID,
      });

      expect(output.delivered).toEqual(["contracted"]);
      expect(notifier.sent).toHaveLength(1);
      expect(notifier.sent[0].to).toBe(contract.contracted.email);
    });

    it("recusa quem não é parte", async () => {
      const contract = await seed();

      await expect(
        useCase.execute({
          contract_id: contract.contract_id.id,
          requesting_participant_ids: ["99999999-9999-4999-8999-999999999999"],
        }),
      ).rejects.toThrow(ForbiddenException);

      expect(notifier.sent).toHaveLength(0);
    });

    // Sem `moment` explícito, o texto tem que acompanhar o estado real.
    it("deriva o momento do status quando não recebe", async () => {
      const contract = await seed();

      await useCase.execute({
        contract_id: contract.contract_id.id,
        requesting_participant_ids: [ESTABLISHMENT_ID],
      });

      expect(notifier.sent[0].moment).toBe("issued");
    });
  });
});
