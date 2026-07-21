import { IUseCase } from "../../../../shared/application/use-case.interface";
import { IGoogleCalendarIntegrationRepository } from "../../../domain/google-calendar-integration.repository";
import {
  GoogleCalendarStatusOutput,
  GoogleCalendarStatusOutputMapper,
} from "../common/google-calendar-integration-output";

export type GetGoogleCalendarStatusInput = {
  musician_id: string;
};

export class GetGoogleCalendarStatusUseCase implements IUseCase<
  GetGoogleCalendarStatusInput,
  GoogleCalendarStatusOutput
> {
  constructor(
    private readonly integrationRepo: IGoogleCalendarIntegrationRepository,
  ) {}

  async execute(
    input: GetGoogleCalendarStatusInput,
  ): Promise<GoogleCalendarStatusOutput> {
    const integration = await this.integrationRepo.findByMusicianId(
      input.musician_id,
    );
    return GoogleCalendarStatusOutputMapper.toOutput(integration);
  }
}
