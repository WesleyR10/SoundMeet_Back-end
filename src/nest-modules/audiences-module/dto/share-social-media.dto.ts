import { OmitType } from "@nestjs/swagger";

import { ShareSocialMediaInput } from "../../../core/audience/application/use-cases/share-social-media/share-social-media.input";

export class ShareSocialMediaInputWithoutAudienceId extends OmitType(
  ShareSocialMediaInput,
  ["audience_id"] as const,
) {}

export class ShareSocialMediaDto extends ShareSocialMediaInputWithoutAudienceId {}
