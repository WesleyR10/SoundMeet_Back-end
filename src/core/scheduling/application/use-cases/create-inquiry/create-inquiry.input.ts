import { Type } from "class-transformer";
import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  validateSync,
} from "class-validator";

export type CreateInquiryInputConstructorProps = {
  establishment_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  subject?: string | null;
  initial_message?: string | null;
  expires_at?: Date | null;
  requesting_participant_ids?: string[] | null;
  requesting_musician_id?: string | null;
  is_admin?: boolean;
};

export class CreateInquiryInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  establishment_id: string;

  @IsString()
  @IsOptional()
  @IsUUID()
  musician_id?: string | null;

  @IsString()
  @IsOptional()
  @IsUUID()
  band_id?: string | null;

  @IsString()
  @IsOptional()
  @IsUUID()
  event_id?: string | null;

  @IsString()
  @IsOptional()
  subject?: string | null;

  @IsString()
  @IsOptional()
  initial_message?: string | null;

  @Type(() => Date)
  @IsDate()
  @IsOptional()
  expires_at?: Date | null;

  // Identidade do ator — preenchida pelo controller a partir do JWT, nunca
  // aceita do corpo da requisição (não há @ApiProperty no DTO correspondente).
  @IsUUID("4", { each: true })
  @IsOptional()
  requesting_participant_ids?: string[] | null;

  // `sub` do JWT, separado dos claims: representar a banda não é decidir por
  // ela — a liderança é checada contra este id (ver negotiation-actor.ts).
  @IsUUID()
  @IsOptional()
  requesting_musician_id?: string | null;

  @IsBoolean()
  @IsOptional()
  is_admin?: boolean;

  constructor(props: CreateInquiryInputConstructorProps) {
    if (!props) return;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id;
    this.band_id = props.band_id;
    this.event_id = props.event_id;
    this.subject = props.subject;
    this.initial_message = props.initial_message;
    this.expires_at = props.expires_at;
    this.requesting_participant_ids = props.requesting_participant_ids;
    this.requesting_musician_id = props.requesting_musician_id;
    this.is_admin = props.is_admin ?? false;
  }
}

export class ValidateCreateInquiryInput {
  static validate(input: CreateInquiryInput) {
    return validateSync(input);
  }
}
