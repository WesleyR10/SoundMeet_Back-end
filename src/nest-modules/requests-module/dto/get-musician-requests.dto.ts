import { OmitType } from "@nestjs/swagger";

import { GetMusicianRequestsInput } from "../../../core/request/application/use-cases/get-musician-requests/get-musician-requests.input";

export class GetMusicianRequestsInputWithoutMusicianId extends OmitType(
  GetMusicianRequestsInput,
  ["musician_id"] as const,
) {}

export class GetMusicianRequestsDto extends GetMusicianRequestsInputWithoutMusicianId {}
