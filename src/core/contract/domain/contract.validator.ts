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
import { CONTRACT_STATUSES } from "./contract-types";

/**
 * Validação de forma do agregado.
 *
 * As regras finas do conteúdo moram nos VOs (`ContractParty`,
 * `ContractVariables`, `RenderedClause`) e **lançam**, porque conteúdo inválido
 * não pode virar documento. Aqui ficam só os campos escalares do agregado, no
 * padrão de notification do projeto.
 */
export class ContractRules {
  @IsIn(CONTRACT_STATUSES as unknown as string[], { groups: ["status"] })
  status: string;

  @IsNotEmpty({ groups: ["template_version"] })
  @IsString({ groups: ["template_version"] })
  template_version: string;

  @Min(1, { groups: ["revision"] })
  @IsInt({ groups: ["revision"] })
  revision: number;

  // SHA-256 em hexadecimal minúsculo — 64 caracteres. Formato errado aqui
  // significa hash calculado de outro jeito, e um hash que não confere é pior
  // que hash nenhum: quebra a verificação sem ninguém saber por quê.
  @Matches(/^[a-f0-9]{64}$/, { groups: ["content_hash"] })
  @IsString({ groups: ["content_hash"] })
  content_hash: string;

  @MaxLength(32, { groups: ["verification_code"] })
  @IsNotEmpty({ groups: ["verification_code"] })
  @IsString({ groups: ["verification_code"] })
  verification_code: string;

  @MaxLength(500, { groups: ["document_key"] })
  @IsOptional({ groups: ["document_key"] })
  @IsString({ groups: ["document_key"] })
  document_key?: string | null;

  @MaxLength(1000, { groups: ["annul_reason"] })
  @IsOptional({ groups: ["annul_reason"] })
  @IsString({ groups: ["annul_reason"] })
  annul_reason?: string | null;

  constructor(data: any) {
    Object.assign(this, {
      status: data.status,
      template_version: data.template_version,
      revision: data.revision,
      content_hash: data.content_hash,
      verification_code: data.verification_code,
      document_key: data.document_key,
      annul_reason: data.annul_reason,
    });
  }
}

export class ContractValidator extends ClassValidatorFields {
  validate(notification: Notification, data: any, fields?: string[]): boolean {
    const newFields = fields?.length
      ? fields
      : [
          "status",
          "template_version",
          "revision",
          "content_hash",
          "verification_code",
          "document_key",
          "annul_reason",
        ];
    return super.validate(notification, new ContractRules(data), newFields);
  }
}

export class ContractValidatorFactory {
  static create() {
    return new ContractValidator();
  }
}
