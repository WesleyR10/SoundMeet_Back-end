import { OmitType } from "@nestjs/swagger";

import { IndicateMusicianInput } from "../../../core/audience/application/use-cases/indicate-musician/indicate-musician.input";

export class IndicateMusicianInputWithoutAudienceId extends OmitType(
  IndicateMusicianInput,
  ["audience_id"] as const,
) {}

export class IndicateMusicianDto extends IndicateMusicianInputWithoutAudienceId {}
