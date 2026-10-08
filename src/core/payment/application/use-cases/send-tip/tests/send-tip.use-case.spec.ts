import { Band, BandId } from "@core/musician/domain/band.aggregate";
import { BandInMemoryRepository } from "@core/musician/infra/db/in-memory/band-in-memory.repository";
import { PaymentMethod, TipInMemoryRepository, TipStatus } from "@core/payment";
import { TipId } from "@core/payment/domain/tip.aggregate";
import { PixKeyType } from "@core/payment/domain/value-objects/pix-key.vo";
import {
  IPixGateway,
  PixPaymentRequest,
  PixPaymentResponse,
} from "@core/payment/infra/gateways/pix-gateway.interface";
import { PlanCheckService, SubscriptionInMemoryRepository } from "@core/plans";
import { Uuid } from "@core/shared/domain/value-objects/uuid.vo";

import { SendTipUseCase } from "../send-tip.use-case";

const BAND_ID = "123e4567-e89b-12d3-a456-426614174002";
const LIDER_ID = "123e4567-e89b-12d3-a456-426614174009";

describe("SendTipUseCase Unit Tests", () => {
  let useCase: SendTipUseCase;
  let repository: TipInMemoryRepository;

  beforeEach(() => {
    repository = new TipInMemoryRepository();
    const planCheckService = new PlanCheckService(
      new SubscriptionInMemoryRepository(),
    );
    useCase = new SendTipUseCase(repository, planCheckService);
  });

  it("should create a tip with PIX payment method", async () => {
    const output = await useCase.execute({
      audience_id: "123e4567-e89b-12d3-a456-426614174000",
      musician_id: "123e4567-e89b-12d3-a456-426614174001",
      amount: 10.0,
      payment_method: PaymentMethod.PIX,
      message: "Great show!",
      pix_key: {
        key: "12345678909",
        type: PixKeyType.CPF,
      },
    });

    expect(output.id).toBeDefined();
    expect(output.status).toBe(TipStatus.PENDING);
    expect(output.qr_code).toBeDefined();
    expect(output.copy_paste_code).toBeDefined();

    const tip = await repository.findById(new TipId(output.id));

    expect(tip).toBeDefined();
    expect(tip?.amount.amount).toBe(10.0);
    expect(tip?.message).toBe("Great show!");
  });

  it("should create an anonymous tip", async () => {
    const output = await useCase.execute({
      audience_id: "123e4567-e89b-12d3-a456-426614174000",
      musician_id: "123e4567-e89b-12d3-a456-426614174001",
      amount: 50.0,
      payment_method: PaymentMethod.CREDIT_CARD,
      is_anonymous: true,
    });

    const tip = await repository.findById(new TipId(output.id));

    expect(tip?.is_anonymous).toBe(true);
  });

  /**
   * O que o use-case entrega ao gateway.
   *
   * Importa porque no Mercado Pago a cobrança é criada **na conta do músico**,
   * com a comissão saindo por `application_fee`. Mandar o beneficiário errado
   * (ou não mandar) faz o dinheiro cair na conta da plataforma — custódia de
   * recurso de terceiro, que a arquitetura recusa.
   */
  describe("entrada do gateway PIX", () => {
    class RecordingPixGateway implements IPixGateway {
      calls: PixPaymentRequest[] = [];

      async generatePayment(
        input: PixPaymentRequest,
      ): Promise<PixPaymentResponse> {
        this.calls.push(input);
        return {
          qr_code: "qr",
          copy_paste_code: "copia-e-cola",
          external_id: "mp_1",
        };
      }
    }

    let gateway: RecordingPixGateway;

    /** 0,99% é a taxa real do Mercado Pago. */
    function useCaseComGateway(gatewayFeePct = 0.99) {
      return new SendTipUseCase(
        repository,
        new PlanCheckService(new SubscriptionInMemoryRepository()),
        gateway,
        gatewayFeePct,
      );
    }

    beforeEach(() => {
      gateway = new RecordingPixGateway();
      useCase = useCaseComGateway();
    });

    it("manda o BENEFICIÁRIO junto da comissão", async () => {
      await useCase.execute({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        amount: 20,
        payment_method: PaymentMethod.PIX,
      });

      expect(gateway.calls).toHaveLength(1);
      expect(gateway.calls[0].beneficiary_musician_id).toBe(
        "123e4567-e89b-12d3-a456-426614174001",
      );
    });

    it('🔴 desconta a taxa do gateway da NOSSA comissão — "1% gateway incluso"', async () => {
      /*
       * No marketplace do MP a taxa dele sai do bruto ANTES da nossa comissão.
       * Se pedíssemos os 9% cheios, o músico seria debitado 9% + 0,99% = 9,99%
       * num plano que anuncia 9% — a promessa da tabela de preços viraria
       * mentira de 1pp.
       *
       * FREE = 9%; 9 − 0,99 = 8,01% de R$20 = R$1,602 → R$1,60.
       * Total debitado do músico: 1,60 (nós) + 0,20 (MP) = R$1,80 = 9%. ✅
       */
      await useCase.execute({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        amount: 20,
        payment_method: PaymentMethod.PIX,
      });

      expect(gateway.calls[0].platform_fee).toBe(1.6);
    });

    it.each([
      [9, 1.6, "FREE"],
      [7, 1.2, "ESSENTIAL"],
      [5, 0.8, "PRO"],
    ] as const)(
      "MP.5 plano %s%% → marketplace_fee R$%s em R$20 (%s)",
      async (planPct, expectedFee) => {
        const planCheck = {
          getMusicianTipFeePercentage: async () => planPct,
        } as PlanCheckService;
        useCase = new SendTipUseCase(
          repository,
          planCheck,
          gateway,
          0.99,
        );

        await useCase.execute({
          audience_id: "123e4567-e89b-12d3-a456-426614174000",
          musician_id: "123e4567-e89b-12d3-a456-426614174001",
          amount: 20,
          payment_method: PaymentMethod.PIX,
        });

        expect(gateway.calls[0].platform_fee).toBe(expectedFee);
      },
    );

    it("sem taxa de gateway, pede o percentual cheio do plano", async () => {
      useCase = useCaseComGateway(0);

      await useCase.execute({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        amount: 20,
        payment_method: PaymentMethod.PIX,
      });

      expect(gateway.calls[0].platform_fee).toBe(1.8);
    });

    it("nunca pede comissão NEGATIVA se a taxa do gateway passar o plano", async () => {
      // Impossível hoje (menor plano é 5% contra 0,99%), mas um
      // `application_fee` negativo seria recusado pelo provedor — e a causa
      // ficaria escondida numa mudança de tabela de preços.
      useCase = useCaseComGateway(50);

      await useCase.execute({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        amount: 20,
        payment_method: PaymentMethod.PIX,
      });

      expect(gateway.calls[0].platform_fee).toBe(0);
    });

    it("calcula em CENTAVOS — nada de 29,999700000000004", async () => {
      await useCase.execute({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        amount: 333.33,
        payment_method: PaymentMethod.PIX,
      });

      // 9 − 0,99 = 8,01% de R$333,33 = 26,699... → R$26,70
      expect(gateway.calls[0].platform_fee).toBe(26.7);
    });

    it("🔴 gorjeta de banda liquida na conta do LÍDER", async () => {
      /*
       * Banda não tem conta no provedor — o vínculo OAuth é sempre de uma
       * pessoa. Sem resolver o líder, o adapter recusaria TODA gorjeta de
       * banda. Mesma decisão de `buildContracted` no contrato: "o MEI é do
       * líder, não da banda".
       */
      const bandRepo = new BandInMemoryRepository();
      const band = Band.create({
        name: "Trio Maré",
        genres: ["mpb"],
        members: [
          {
            musician_id: new Uuid(LIDER_ID),
            role: "leader",
            instrument: "voz",
            status: "accepted",
            joined_at: new Date("2026-01-01T00:00:00.000Z"),
            responded_at: null,
          },
        ],
      });
      band.band_id = new BandId(BAND_ID);
      await bandRepo.insert(band);

      useCase = new SendTipUseCase(
        repository,
        new PlanCheckService(new SubscriptionInMemoryRepository()),
        gateway,
        0.99,
        bandRepo,
      );

      await useCase.execute({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        band_id: BAND_ID,
        amount: 30,
        payment_method: PaymentMethod.PIX,
      });

      expect(gateway.calls[0].beneficiary_musician_id).toBe(LIDER_ID);
      // O `band_id` segue na metadata: é ele que faz a confirmação dividir
      // entre os integrantes.
      expect(gateway.calls[0].metadata?.band_id).toBe(BAND_ID);
    });

    it("banda sem líder resolvível vai com beneficiário nulo — o adapter recusa com erro traduzível", async () => {
      const bandRepo = new BandInMemoryRepository();
      useCase = new SendTipUseCase(
        repository,
        new PlanCheckService(new SubscriptionInMemoryRepository()),
        gateway,
        0.99,
        bandRepo,
      );

      await useCase.execute({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        band_id: BAND_ID,
        amount: 30,
        payment_method: PaymentMethod.PIX,
      });

      expect(gateway.calls[0].beneficiary_musician_id).toBeNull();
    });

    it("não chama o gateway quando o método não é PIX", async () => {
      await useCase.execute({
        audience_id: "123e4567-e89b-12d3-a456-426614174000",
        musician_id: "123e4567-e89b-12d3-a456-426614174001",
        amount: 20,
        payment_method: PaymentMethod.WALLET,
      });

      expect(gateway.calls).toHaveLength(0);
    });
  });
});
