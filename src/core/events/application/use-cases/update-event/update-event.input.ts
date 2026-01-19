import {
  IsBoolean,
  IsDate,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  validateSync,
} from "class-validator";

export type UpdateEventInputConstructorProps = {
  id: string;
  establishment_id: string;
  name?: string;
  description?: string | null;
  date?: Date;
  start_at?: Date;
  end_at?: Date;
  max_capacity?: number | null;
  is_public?: boolean;
  cover_charge?: number | null;
};

export class UpdateEventInput {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  establishment_id: string;

  @IsString()
  @IsOptional()
  @MaxLength(255)
  name?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string | null;

  @IsDate()
  @IsOptional()
  date?: Date;

  @IsDate()
  @IsOptional()
  start_at?: Date;

  @IsDate()
  @IsOptional()
  end_at?: Date;

  @IsInt()
  @Min(0)
  @IsOptional()
  max_capacity?: number | null;

  @IsBoolean()
  @IsOptional()
  is_public?: boolean;

  @IsNumber()
  @Min(0)
  @IsOptional()
  cover_charge?: number | null;

  constructor(props: UpdateEventInputConstructorProps) {
    if (!props) return;
    this.id = props.id;
    this.establishment_id = props.establishment_id;
    this.name = props.name;
    this.description = props.description;
    this.date = props.date;
    this.start_at = props.start_at;
    this.end_at = props.end_at;
    this.max_capacity = props.max_capacity;
    this.is_public = props.is_public;
    this.cover_charge = props.cover_charge;
  }
}

export class ValidateUpdateEventInput {
  static validate(input: UpdateEventInput) {
    return validateSync(input);
  }
}
