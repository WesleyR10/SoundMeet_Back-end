import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { SendTipInput } from "./send-tip.input";

export class SendTipUseCase implements IUseCase<SendTipInput, SendTipOutput> {
  constructor(
    private readonly audienceRepository: IAudienceRepository,
    private readonly sendTipUseCase: IUseCase<any, any>,
  ) {}

  async execute(input: SendTipInput): Promise<SendTipOutput> {
    const audienceId = new AudienceId(input.id);
    const audience = await this.audienceRepository.findById(audienceId);

    if (!audience) {
      throw new NotFoundError(input.id, Audience);
    }

    audience.ensureIsActive();
    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    const tip = await this.sendTipUseCase.execute({
      audience_id: input.id,
      musician_id: input.musician_id,
      event_id: input.event_id,
      amount: input.amount,
      message: input.message,
      payment_method: input.payment_method,
      is_anonymous: input.is_anonymous,
      metadata: input.metadata,
    });

    return {
      audience: AudienceOutputMapper.toOutput(audience),
      points_earned: 0,
      new_badges: [],
      new_level: undefined,
      tip_metadata: {
        tip_id: tip.id,
        musician_id: input.musician_id,
        amount: input.amount,
        message: input.message,
        payment_method: input.payment_method || "pix",
        establishment_id: input.establishment_id,
        event_id: input.event_id,
        metadata: input.metadata,
        sent_at: new Date(),
        status: tip.status ?? "pending",
      },
    };
  }
}

export type SendTipOutput = {
  audience: AudienceOutput;
  points_earned: number;
  new_badges: string[];
  new_level: number | undefined;
  tip_metadata: {
    tip_id: string;
    musician_id: string;
    amount: number;
    message?: string;
    payment_method: string;
    establishment_id?: string;
    event_id?: string;
    metadata?: Record<string, any>;
    sent_at: Date;
    status: "sent" | "pending" | "failed" | "success";
  };
};
