import { IBandRepository } from "../../../../musician/domain/band.repository";
import { IClock } from "../../../../shared/application/clock.interface";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Inquiry, InquiryId } from "../../../domain/inquiry.aggregate";
import { IInquiryRepository } from "../../../domain/inquiry.repository";
import { InquiryOutput, InquiryOutputMapper } from "../common/inquiry-output";
import { assertNegotiationParticipant } from "../common/negotiation-actor";
import { AcceptInquiryInput } from "./accept-inquiry.input";

export class AcceptInquiryUseCase implements IUseCase<
  AcceptInquiryInput,
  InquiryOutput
> {
  constructor(
    private readonly inquiryRepo: IInquiryRepository,
    private readonly clock: IClock = { now: () => new Date() },
    private readonly domainEventMediator?: DomainEventMediator,
    private readonly bandRepo?: IBandRepository,
  ) {}

  async execute(input: AcceptInquiryInput): Promise<InquiryOutput> {
    const inquiryId = new InquiryId(input.inquiry_id);
    const entity = await this.inquiryRepo.findById(inquiryId);
    if (!entity) {
      throw new NotFoundError(input.inquiry_id, Inquiry);
    }

    // Só o lado contratado aceita — o estabelecimento é quem propôs. Sendo
    // banda, só o líder: o aceite compromete a agenda de todos os integrantes.
    await assertNegotiationParticipant(
      input,
      {
        musician_id: entity.musician_id?.id ?? null,
        band_id: entity.band_id?.id ?? null,
      },
      "aceitar esta inquiry",
      this.bandRepo,
    );

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
