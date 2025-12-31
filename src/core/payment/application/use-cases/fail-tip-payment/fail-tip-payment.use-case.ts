import { ITipRepository, Tip } from "@core/payment";
import { IUseCase } from "@core/shared/application/use-case.interface";
import { NotFoundError } from "@core/shared/domain/errors";
import { Uuid } from "@core/shared/domain/value-objects";

export type FailTipPaymentInput = {
  tip_id: string;
  reason?: string;
};

export type FailTipPaymentOutput = {
  tip_id: string;
  status: string;
};

export class FailTipPaymentUseCase implements IUseCase<
  FailTipPaymentInput,
  FailTipPaymentOutput
> {
  constructor(private readonly tipRepo: ITipRepository) {}

  async execute(input: FailTipPaymentInput): Promise<FailTipPaymentOutput> {
    const tip = await this.tipRepo.findById(new Uuid(input.tip_id));
    if (!tip) {
      throw new NotFoundError(input.tip_id, Tip);
    }

    tip.fail();
    await this.tipRepo.update(tip);

    return {
      tip_id: tip.tip_id.id,
      status: tip.status,
    };
  }
}
