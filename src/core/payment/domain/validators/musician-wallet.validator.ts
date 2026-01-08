import {
  IsBoolean,
  IsDate,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../../shared/domain/validators/notification";
import { MusicianWallet } from "../musician-wallet.aggregate";

export class MusicianWalletRules {
  @IsNotEmpty({ groups: ["musician_id"] })
  @IsUUID(undefined, { groups: ["musician_id"] })
  musician_id: string;

  @IsNotEmpty({ groups: ["balance"] })
  @IsNumber({}, { groups: ["balance"] })
  @Min(0, { groups: ["balance"] })
  balance: number;

  @IsNotEmpty({ groups: ["total_earned"] })
  @IsNumber({}, { groups: ["total_earned"] })
  @Min(0, { groups: ["total_earned"] })
  total_earned: number;

  @IsNotEmpty({ groups: ["total_withdrawn"] })
  @IsNumber({}, { groups: ["total_withdrawn"] })
  @Min(0, { groups: ["total_withdrawn"] })
  total_withdrawn: number;

  @IsOptional({ groups: ["pix_key"] })
  @IsString({ groups: ["pix_key"] })
  pix_key: string | null;

  @IsBoolean({ groups: ["is_active"] })
  @IsOptional({ groups: ["is_active"] })
  is_active: boolean;

  @IsDate({ groups: ["created_at"] })
  @IsOptional({ groups: ["created_at"] })
  created_at: Date;

  @IsDate({ groups: ["updated_at"] })
  @IsOptional({ groups: ["updated_at"] })
  updated_at: Date;

  constructor(data: MusicianWallet) {
    this.musician_id = data.musician_id.id;
    this.balance = data.balance.amount;
    this.total_earned = data.total_earned.amount;
    this.total_withdrawn = data.total_withdrawn.amount;
    this.pix_key = data.pix_key?.key ?? null;
    this.is_active = data.is_active;
    this.created_at = data.created_at;
    this.updated_at = data.updated_at;
  }
}

export class MusicianWalletValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "musician_id",
          "balance",
          "total_earned",
          "total_withdrawn",
          "pix_key",
          "is_active",
          "created_at",
          "updated_at",
        ];
    return super.validate(
      notification,
      new MusicianWalletRules(data),
      newFields,
    );
  }
}

export class MusicianWalletValidatorFactory {
  static create(): MusicianWalletValidator {
    return new MusicianWalletValidator();
  }
}
