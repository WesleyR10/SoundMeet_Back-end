import { OmitType } from "@nestjs/swagger";
import { AddUnavailabilityInput } from "../../../core/scheduling/application/use-cases/add-unavailability/add-unavailability.input";

export class AddUnavailabilityDto extends OmitType(AddUnavailabilityInput, [
  "musician_id",
] as const) {}
