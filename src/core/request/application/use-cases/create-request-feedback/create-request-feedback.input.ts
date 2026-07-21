import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  validateSync,
} from "class-validator";

export type CreateRequestFeedbackInputConstructorProps = {
  request_id: string;
  rating: number;
  comment?: string | null;
  musician_id?: string;
};

export class CreateRequestFeedbackInput {
  @IsUUID()
  @IsNotEmpty()
  request_id: string;

  @IsInt()
  @Min(1, { message: "Rating must be at least 1" })
  @Max(5, { message: "Rating cannot exceed 5" })
  @IsNotEmpty()
  rating: number;

  @IsString()
  @IsOptional()
  @MaxLength(500, { message: "Comment cannot exceed 500 characters" })
  comment?: string | null;

  // Músico autenticado que está avaliando (undefined = admin, pula a checagem
  // de ownership — mesmo padrão de mark-request-played.input.ts).
  @IsUUID()
  @IsOptional()
  musician_id?: string;

  constructor(props: CreateRequestFeedbackInputConstructorProps) {
    if (!props) return;

    this.request_id = props.request_id;
    this.rating = props.rating;
    this.comment = props.comment;
    this.musician_id = props.musician_id;
  }
}

export class ValidateCreateRequestFeedbackInput {
  static validate(input: CreateRequestFeedbackInput) {
    return validateSync(input);
  }
}
