import { IsBoolean, IsDate, IsNotEmpty, IsOptional } from "class-validator";

import { ClassValidatorFields } from "../../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../../shared/domain/validators/notification";

export class MusicianWalletRules {
  @IsNotEmpty()
  musician_id: any;

  @IsNotEmpty()
  balance: any;

  @IsNotEmpty()
  total_earned: any;

  @IsNotEmpty()
  total_withdrawn: any;

  @IsOptional()
  pix_key: any;

  @IsBoolean()
  @IsOptional()
  is_active: boolean;

  @IsDate()
  @IsOptional()
  created_at: Date;

  @IsDate()
  @IsOptional()
  updated_at: Date;

  constructor(data: any) {
    Object.assign(this, data);
  }
}

export class MusicianWalletValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length ? fields : [];
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
