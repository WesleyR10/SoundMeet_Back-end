import { OmitType } from "@nestjs/mapped-types";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import { Type } from "class-transformer";
import {
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
  Min,
  MinLength,
} from "class-validator";

import { IssueContractInput } from "../../../core/contract/application/use-cases/issue-contract/issue-contract.input";
import { SignContractInput } from "../../../core/contract/application/use-cases/sign-contract/sign-contract.input";
import { CONTRACT_STATUSES } from "../../../core/contract/domain/contract-types";

/**
 * DTOs do módulo de contrato.
 *
 * Padrão do projeto: o DTO **estende o Input do core** e usa `OmitType` para
 * remover o que vem da rota ou do JWT. Assim a validação vive num lugar só, e
 * campos de identidade não podem ser injetados pelo corpo — com
 * `whitelist: true` no ValidationPipe global, o que não está declarado é
 * **removido** antes de chegar ao handler.
 */

export class SignContractDto extends OmitType(SignContractInput, [
  "contract_id",
  "requesting_user_id",
  "requesting_participant_ids",
  "requesting_musician_id",
  "is_admin",
  "observed_ip",
  "forwarded_for",
  "user_agent",
] as const) {
  @ApiProperty({
    description:
      "Declaração expressa de concordância com os termos. Precisa vir de um aceite dedicado (checkbox), nunca inferido de navegação — é o que sustenta a validade da assinatura eletrônica (MP 2.200-2, art. 10, §2º).",
    example: true,
  })
  declare accept_terms: boolean;
}

/**
 * Retentativa de emissão. **Carrega só o `booking_id`.**
 *
 * `outdoor`, `exclusivity_requested` e `tone` existem no `IssueContractInput` e
 * são preenchidos pelo `ContractIssuanceHandler` — mas saem daqui por
 * `OmitType`, e com `whitelist: true` o `ValidationPipe` global os descarta se
 * vierem no corpo. É decisão de produto da fatia B3, não economia de campo:
 * exclusividade é opt-in com tetos legais e não cabe num botão de "tentar de
 * novo", e o tom da redação não pode ser escolhido por uma parte para a outra
 * assinar.
 *
 * `requesting_participant_ids` e `is_admin` saem pelo motivo de sempre: campo
 * de identidade nunca vem do corpo. Quem os preenche é o controller, a partir
 * do JWT.
 */
export class IssueContractDto extends OmitType(IssueContractInput, [
  "requesting_participant_ids",
  "is_admin",
  "outdoor",
  "exclusivity_requested",
  "tone",
] as const) {
  @ApiProperty({ format: "uuid" })
  declare booking_id: string;
}

export class AnnulContractDto {
  @ApiProperty({
    description: "Motivo da anulação. Obrigatório e registrado no contrato.",
    maxLength: 1000,
  })
  @MaxLength(1000)
  @MinLength(3)
  @IsString()
  reason: string;
}

export class SearchContractsDto {
  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Min(1)
  @IsInt()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ minimum: 1 })
  @IsOptional()
  @Min(1)
  @IsInt()
  @Type(() => Number)
  per_page?: number;

  /**
   * ⚠️ Nome de COLUNA do Prisma, não do domínio — e campo fora da lista é 422,
   * sem fallback. Mesma armadilha registrada em `SearchEventsDto` (9.7d).
   */
  @ApiPropertyOptional({ enum: ["created_at", "issued_at", "signed_at"] })
  @IsOptional()
  @IsIn(["created_at", "issued_at", "signed_at"])
  sort?: string;

  @ApiPropertyOptional({ enum: ["asc", "desc"] })
  @IsOptional()
  @IsIn(["asc", "desc"])
  sort_dir?: "asc" | "desc";

  @ApiPropertyOptional({ enum: CONTRACT_STATUSES })
  @IsOptional()
  @IsIn(CONTRACT_STATUSES as unknown as string[])
  status?: string;

  @ApiPropertyOptional({
    format: "uuid",
    description:
      "Refina DENTRO do escopo do token. Pedir o booking de outro devolve zero, não 403.",
  })
  @IsOptional()
  @IsUUID("4")
  booking_id?: string;
}

export class GetContractDocumentQueryDto {
  @ApiPropertyOptional({
    enum: ["contract", "certificate"],
    description:
      "`contract` = o instrumento assinado; `certificate` = o Anexo II com a trilha de auditoria.",
  })
  @IsOptional()
  @IsIn(["contract", "certificate"])
  kind?: "contract" | "certificate";
}
