import { IUseCase } from "../../../../shared/application/use-case.interface";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Inquiry } from "../../../domain/inquiry.aggregate";
import { IInquiryRepository } from "../../../domain/inquiry.repository";
import { InquiryOutput, InquiryOutputMapper } from "../common/inquiry-output";
import { CreateInquiryInput } from "./create-inquiry.input";

export class CreateInquiryUseCase implements IUseCase<
  CreateInquiryInput,
  InquiryOutput
> {
  constructor(
    private readonly inquiryRepo: IInquiryRepository,
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: CreateInquiryInput): Promise<InquiryOutput> {
    const entity = Inquiry.create({
      establishment_id: input.establishment_id,
      musician_id: input.musician_id ?? null,
      band_id: input.band_id ?? null,
      event_id: input.event_id ?? null,
      subject: input.subject ?? null,
      initial_message: input.initial_message ?? null,
      expires_at: input.expires_at ?? null,
    });

    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.inquiryRepo.insert(entity);

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entity);
      await this.domainEventMediator.publishIntegrationEvents(entity);
      entity.clearEvents();
    }

    return InquiryOutputMapper.toOutput(entity);
  }
}
