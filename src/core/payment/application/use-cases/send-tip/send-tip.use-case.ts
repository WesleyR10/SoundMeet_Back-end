import { IPixGateway, ITipRepository, PaymentMethod, Tip } from "@core/payment";
import { PlanCheckService } from "@core/plans";
import { IUseCase } from "@core/shared/application/use-case.interface";

export type SendTipInput = {
  audience_id: string;
  musician_id?: string;
  band_id?: string;
  event_id?: string;
  amount: number;
  message?: string;
  payment_method: PaymentMethod;
  pix_key?: { key: string; type: string };
  is_anonymous?: boolean;
  show_in_wall?: boolean;
};

export type SendTipOutput = {
  id: string;
  status: string;
  /** Percentual de taxa retido pela plataforma (ex.: 8 = 8%). Baseado no plano do músico. */
  platform_fee_percentage: number;
  qr_code?: string;
  copy_paste_code?: string;
};

export class SendTipUseCase implements IUseCase<SendTipInput, SendTipOutput> {
  constructor(
    private tipRepository: ITipRepository,
    private readonly planCheckService: PlanCheckService,
    private readonly pixGateway?: IPixGateway,
  ) {}

  async execute(input: SendTipInput): Promise<SendTipOutput> {
    const platform_fee_percentage = input.musician_id
      ? await this.planCheckService.getMusicianTipFeePercentage(
          input.musician_id,
        )
      : 8; // taxa padrão quando músico não identificado

    const tip = Tip.create({
      audience_id: input.audience_id,
      musician_id: input.musician_id,
      band_id: input.band_id,
      event_id: input.event_id,
      amount: input.amount,
      message: input.message,
      payment_method: input.payment_method,
      pix_key: input.pix_key,
      is_anonymous: input.is_anonymous,
      show_in_wall: input.show_in_wall,
    });

    await this.tipRepository.insert(tip);

    let qr_code, copy_paste_code;
    if (input.payment_method === PaymentMethod.PIX) {
      if (this.pixGateway) {
        const res = await this.pixGateway.generatePayment({
          amount: input.amount,
          metadata: {
            musician_id: input.musician_id,
            band_id: input.band_id,
            tip_id: tip.tip_id.id,
          },
        });
        qr_code = res.qr_code;
        copy_paste_code = res.copy_paste_code;
      } else {
        qr_code = "mock_qr_code_base64";
        copy_paste_code = "mock_copy_paste_code";
      }
    }

    return {
      id: tip.tip_id.id,
      status: tip.status,
      platform_fee_percentage,
      qr_code,
      copy_paste_code,
    };
  }
}
