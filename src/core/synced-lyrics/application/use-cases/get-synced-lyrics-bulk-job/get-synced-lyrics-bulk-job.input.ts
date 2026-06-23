import { IsNotEmpty, IsUUID } from "class-validator";
import { validateSync } from "class-validator";

export class GetSyncedLyricsBulkJobInput {
  @IsUUID()
  @IsNotEmpty()
  id: string;

  constructor(props: { id: string }) {
    this.id = props.id;
  }
}

export class ValidateGetSyncedLyricsBulkJobInput {
  static validate(input: GetSyncedLyricsBulkJobInput) {
    return validateSync(input);
  }
}
