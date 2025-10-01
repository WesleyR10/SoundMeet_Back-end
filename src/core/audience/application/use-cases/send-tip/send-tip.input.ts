import {
  IsNotEmpty,
  IsString,
  IsOptional,
  IsNumber,
  IsPositive,
  IsObject,
} from "class-validator";

export type SendTipInput = {
  id: string;
  musician_id: string;
  amount: number;
  message?: string;
  payment_method: "pix" | "credit_card" | "debit_card";
  event_id?: string;
  establishment_id?: string;
  is_anonymous?: boolean;
  metadata?: Record<string, any>;
};

export class SendTipInputValidator {
  @IsString()
  @IsNotEmpty()
  id: string;

  @IsString()
  @IsNotEmpty()
  musician_id: string;

  @IsNumber()
  @IsPositive()
  amount: number;

  @IsString()
  @IsOptional()
  message?: string;

  @IsString()
  @IsNotEmpty()
  payment_method: "pix" | "credit_card" | "debit_card";

  @IsString()
  @IsOptional()
  event_id?: string;

  @IsString()
  @IsOptional()
  establishment_id?: string;

  @IsOptional()
  is_anonymous?: boolean;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, any>;

  constructor(props: SendTipInput) {
    Object.assign(this, props);
  }
}
