import { OmitType } from "@nestjs/swagger";

import { GetRequestSuggestionsInput } from "../../../core/request/application/use-cases/get-request-suggestions/get-request-suggestions.input";

export class GetRequestSuggestionsInputWithoutMusicianId extends OmitType(
  GetRequestSuggestionsInput,
  ["musician_id"] as const,
) {}

export class GetRequestSuggestionsDto extends GetRequestSuggestionsInputWithoutMusicianId {}
