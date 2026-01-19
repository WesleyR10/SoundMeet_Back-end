import { Type } from "class-transformer";
import {
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsUUID,
  Min,
  validateSync,
} from "class-validator";

export type GetRequestSuggestionsInputConstructorProps = {
  musician_id: string;
  limit?: number;
};

export class GetRequestSuggestionsInput {
  @IsUUID()
  @IsNotEmpty()
  musician_id: string;

  @IsNumber()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;

  constructor(props: GetRequestSuggestionsInputConstructorProps) {
    if (!props) return;

    this.musician_id = props.musician_id;
    this.limit = props.limit ?? 10;
  }
}

export class ValidateGetRequestSuggestionsInput {
  static validate(input: GetRequestSuggestionsInput) {
    return validateSync(input);
  }
}
