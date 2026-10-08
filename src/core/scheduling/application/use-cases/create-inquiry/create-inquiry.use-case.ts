import { BandId } from "../../../../musician/domain/band.aggregate";
import { IBandRepository } from "../../../../musician/domain/band.repository";
import { IUseCase } from "../../../../shared/application/use-case.interface";
import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Inquiry } from "../../../domain/inquiry.aggregate";
import { IInquiryRepository } from "../../../domain/inquiry.repository";
import { InquiryOutput, InquiryOutputMapper } from "../common/inquiry-output";
import { assertNegotiationParticipant } from "../common/negotiation-actor";
import { CreateInquiryInput } from "./create-inquiry.input";

export class CreateInquiryUseCase implements IUseCase<
  CreateInquiryInput,
  InquiryOutput
> {
  constructor(
    private readonly inquiryRepo: IInquiryRepository,
    private readonly domainEventMediator?: DomainEventMediator,
    private readonly bandRepo?: IBandRepository,
  ) {}

  async execute(input: CreateInquiryInput): Promise<InquiryOutput> {
    // Quem cria a negociação precisa ser um dos lados dela. Sem isto, qualquer
    // conta com role permitida abria inquiry em nome de terceiros.
    await assertNegotiationParticipant(
      input,
      input,
      "criar esta negociação",
      this.bandRepo,
    );

    // Banda dissolvida continua existindo (arquivada) para o histórico — e
    // por isso precisa ser recusada na porta, senão quem guardou o id seguiria
    // abrindo conversa com uma banda que não toca mais.
    if (input.band_id && this.bandRepo) {
      const band = await this.bandRepo.findById(new BandId(input.band_id));
      if (band?.isArchived) {
        throw new InvalidOperationError(
          "Esta banda foi dissolvida e não recebe novas propostas.",
        );
      }
    }

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
