import { ForbiddenException } from "@nestjs/common";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Inquiry, InquiryId } from "../../../domain/inquiry.aggregate";
import { IInquiryRepository } from "../../../domain/inquiry.repository";
import { InquiryOutput, InquiryOutputMapper } from "../common/inquiry-output";
import { AcceptInquiryInput } from "./accept-inquiry.input";

export class AcceptInquiryUseCase implements IUseCase<
  AcceptInquiryInput,
  InquiryOutput
> {
  constructor(
    private readonly inquiryRepo: IInquiryRepository,
    private readonly clock: IClock = { now: () => new Date() },
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: AcceptInquiryInput): Promise<InquiryOutput> {
    const inquiryId = new InquiryId(input.inquiry_id);
    const entity = await this.inquiryRepo.findById(inquiryId);
    if (!entity) {
      throw new NotFoundError(input.inquiry_id, Inquiry);
    }

    if (input.requesting_user_id && !input.is_admin) {
      const isOwner =
        entity.musician_id?.id === input.requesting_user_id ||
        entity.band_id?.id === input.requesting_user_id;
      if (!isOwner) {
        throw new ForbiddenException(
          "Você não tem permissão para aceitar esta inquiry.",
        );
      }
    }

    entity.accept(this.clock.now());
    if (entity.notification.hasErrors()) {
      throw new EntityValidationError(entity.notification.toJSON());
    }

    await this.inquiryRepo.update(entity);

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(entity);
      await this.domainEventMediator.publishIntegrationEvents(entity);
      entity.clearEvents();
    }

    return InquiryOutputMapper.toOutput(entity);
  }
}
