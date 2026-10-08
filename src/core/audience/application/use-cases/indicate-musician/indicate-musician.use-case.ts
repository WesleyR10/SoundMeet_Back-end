import { IUseCase } from "../../../../shared/application/use-case.interface";
import { NotFoundError } from "../../../../shared/domain/errors/not-found.error";
import { DomainEventMediator } from "../../../../shared/domain/events/domain-event-mediator";
import { EntityValidationError } from "../../../../shared/domain/validators/validation.error";
import { Audience, AudienceId } from "../../../domain/audience.aggregate";
import { IAudienceRepository } from "../../../domain/audience.repository";
import {
  AudienceOutput,
  AudienceOutputMapper,
} from "../common/audience-output";
import { IndicateMusicianInput } from "./indicate-musician.input";

export class IndicateMusicianUseCase implements IUseCase<
  IndicateMusicianInput,
  AudienceOutput
> {
  /**
   * 🔴 Sem o mediator, `applyEvent` só acumula o evento no agregado e ninguém
   * o publica — foi exatamente esse o estado até 28/set/2026, e é por isso que
   * os pontos nunca chegavam ao ledger da gamificação. Opcional para casar com
   * o padrão dos demais use-cases do projeto (`CreateRequestUseCase`); há teste
   * que prova a publicação, para que a ausência falhe alto.
   */
  constructor(
    private audienceRepository: IAudienceRepository,
    private readonly domainEventMediator?: DomainEventMediator,
  ) {}

  async execute(input: IndicateMusicianInput): Promise<AudienceOutput> {
    const audienceId = new AudienceId(input.audience_id);
    const audience = await this.audienceRepository.findById(audienceId);
    if (!audience) {
      throw new NotFoundError(input.audience_id, Audience);
    }

    audience.ensureIsActive();
    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    // Indicar músico
    audience.indicateMusician(
      input.establishment_id,
      input.musician_id,
      input.message,
    );

    if (audience.notification.hasErrors()) {
      throw new EntityValidationError(audience.notification.toJSON());
    }

    await this.audienceRepository.update(audience);

    if (this.domainEventMediator) {
      await this.domainEventMediator.publish(audience);
      await this.domainEventMediator.publishIntegrationEvents(audience);
    }

    return AudienceOutputMapper.toOutput(audience);
  }
}
