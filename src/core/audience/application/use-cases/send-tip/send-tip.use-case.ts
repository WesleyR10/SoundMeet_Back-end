import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IAudienceRepository } from "../../../domain/audience.repository";
import { AudienceId, Audience } from "../../../domain/audience.aggregate";
import { SendTipInput } from "./send-tip.input";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Points } from "../../../../shared/domain/value-objects/points.vo";

export class SendTipUseCase implements IUseCase<SendTipInput, SendTipOutput> {
  constructor(private readonly audienceRepository: IAudienceRepository) {}

  async execute(input: SendTipInput): Promise<SendTipOutput> {
    const audienceId = new AudienceId(input.id);
    const audience = await this.audienceRepository.findById(audienceId);

    if (!audience) {
      throw new NotFoundError(input.id, Audience);
    }

    // Calculate points earned from tip (1 point per real)
    const tipPoints = Points.createTip(input.amount, {
      musician_id: input.musician_id,
      amount: input.amount,
      message: input.message,
      payment_method: input.payment_method,
      establishment_id: input.establishment_id,
      event_id: input.event_id,
    });

    // Send tip using aggregate method (only requires 3 parameters)
    audience.sendTip(input.musician_id, input.amount, input.message);

    // Validate the aggregate after changes
    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    // Update the audience in repository
    await this.audienceRepository.update(audience);

    return {
      audience: AudienceOutputMapper.toOutput(audience),
      points_earned: tipPoints.value,
      new_badges: [], // TODO: Implement badge logic for tips
      new_level: undefined, // TODO: Implement level update logic
      tip_metadata: {
        musician_id: input.musician_id,
        amount: input.amount,
        message: input.message,
        payment_method: input.payment_method || "pix",
        establishment_id: input.establishment_id,
        event_id: input.event_id,
        metadata: input.metadata,
        sent_at: new Date(),
        status: "success",
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
