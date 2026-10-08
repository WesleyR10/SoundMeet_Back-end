import {
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from "class-validator";

import { ClassValidatorFields } from "../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../shared/domain/validators/notification";

/**
 * Valores literais em vez de importar as constantes do agregado: o agregado
 * importa este validator em `validate()`, e importar de volta fecharia um ciclo
 * em tempo de execução. É o mesmo motivo pelo qual `repertoire.validator.ts`
 * também usa literais. Os testes do agregado amarram os dois lados.
 */
const NOTES_MAX_LENGTH = 5000;
const SHARE_SCOPES = ["private", "band", "community"];

export class PersonalChordSheetRules {
  @IsNotEmpty({ groups: ["musician_id"] })
  @IsString({ groups: ["musician_id"] })
  musician_id: string;

  @IsNotEmpty({ groups: ["music_library_id"] })
  @IsString({ groups: ["music_library_id"] })
  music_library_id: string;

  /** sha256 em hex — 64 caracteres. Ver computeChordSheetBaseFingerprint. */
  @Matches(/^[0-9a-f]{64}$/, {
    groups: ["base_fingerprint"],
    message: "base_fingerprint deve ser um sha256 em hexadecimal.",
  })
  @IsNotEmpty({ groups: ["base_fingerprint"] })
  @IsString({ groups: ["base_fingerprint"] })
  base_fingerprint: string;

  @Min(1, { groups: ["base_pipeline_version"] })
  @IsInt({ groups: ["base_pipeline_version"] })
  base_pipeline_version: number;

  @Min(0, { groups: ["base_version"] })
  @IsInt({ groups: ["base_version"] })
  base_version: number;

  @IsIn(SHARE_SCOPES, { groups: ["share_scope"] })
  share_scope: string;

  @MaxLength(NOTES_MAX_LENGTH, { groups: ["notes"] })
  @IsString({ groups: ["notes"] })
  @IsOptional({ groups: ["notes"] })
  notes: string | null;

  constructor(data: any) {
    Object.assign(this, {
      musician_id: data.musician_id,
      music_library_id: data.music_library_id,
      base_fingerprint: data.base_fingerprint,
      base_pipeline_version: data.base_pipeline_version,
      base_version: data.base_version,
      share_scope: data.share_scope,
      notes: data.notes,
    });
  }
}

export class PersonalChordSheetValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "musician_id",
          "music_library_id",
          "base_fingerprint",
          "base_pipeline_version",
          "base_version",
          "share_scope",
          "notes",
        ];
    return super.validate(
      notification,
      new PersonalChordSheetRules(data),
      newFields,
    );
  }
}

export class PersonalChordSheetValidatorFactory {
  static create(): PersonalChordSheetValidator {
    return new PersonalChordSheetValidator();
  }
}
