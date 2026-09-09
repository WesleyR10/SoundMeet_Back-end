import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

import {
  ContractOutput,
  ContractVerificationOutput,
} from "../../core/contract/application/use-cases/common/contract-output";
import { CollectionPresenter } from "../shared-module/collection.presenter";

/**
 * Resposta do contrato para quem é parte.
 *
 * ⚠️ **`document_key` e `certificate_key` não aparecem aqui.** São chaves de
 * storage privado; o download passa por `GET /contracts/:contract_id/document`,
 * que autoriza e faz stream. Expor a chave transformaria a rota autorizada em
 * teatro — e é exatamente o tipo de vazamento que a ausência de `getPublicUrl`
 * na porta de storage quis tornar impossível.
 */
export class ContractPresenter {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  booking_id: string;

  @ApiProperty({ format: "uuid" })
  establishment_id: string;

  @ApiProperty({ format: "uuid", nullable: true })
  musician_id: string | null;

  @ApiProperty({ format: "uuid", nullable: true })
  band_id: string | null;

  @ApiProperty({ description: "Aditivo é revisão maior, nunca edição." })
  revision: number;

  @ApiProperty({ example: "show-v1" })
  template_version: string;

  @ApiProperty({
    enum: ["issued", "partially_signed", "signed", "annulled"],
  })
  status: string;

  @ApiProperty({ description: "Qualificação congelada do contratante." })
  contractor: ContractOutput["contractor"];

  @ApiProperty({ description: "Qualificação congelada do contratado." })
  contracted: ContractOutput["contracted"];

  @ApiProperty({
    description:
      "Cláusulas já renderizadas, na ordem do documento. É a fonte que as UIs renderizam nativamente — o PDF é derivado disto.",
    isArray: true,
  })
  clauses: ContractOutput["clauses"];

  @ApiProperty({ description: "Variáveis resolvidas e formatadas em pt-BR." })
  variables: ContractOutput["variables"];

  @ApiProperty({ description: "Trilha de aceites.", isArray: true })
  signatures: ContractOutput["signatures"];

  @ApiProperty({
    description:
      "SHA-256 da serialização canônica do conteúdo. O mesmo impresso no rodapé do PDF.",
  })
  content_hash: string;

  @ApiProperty({ description: "Código público de conferência." })
  verification_code: string;

  @ApiProperty()
  has_document: boolean;

  @ApiProperty()
  has_certificate: boolean;

  @ApiProperty({
    description: "Lados que ainda não assinaram.",
    isArray: true,
    enum: ["contractor", "contracted"],
  })
  pending_signatures: ContractOutput["pending_signatures"];

  @Transform(({ value }: { value: Date }) => value?.toISOString())
  @ApiProperty({ format: "date-time" })
  issued_at: Date;

  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  @ApiProperty({ format: "date-time", nullable: true })
  signed_at: Date | null;

  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  @ApiProperty({ format: "date-time", nullable: true })
  annulled_at: Date | null;

  @ApiProperty({ nullable: true })
  annul_reason: string | null;

  @Transform(({ value }: { value: Date }) => value?.toISOString())
  @ApiProperty({ format: "date-time" })
  created_at: Date;

  @Transform(({ value }: { value: Date }) => value?.toISOString())
  @ApiProperty({ format: "date-time" })
  updated_at: Date;

  constructor(output: ContractOutput) {
    this.id = output.id;
    this.booking_id = output.booking_id;
    this.establishment_id = output.establishment_id;
    this.musician_id = output.musician_id;
    this.band_id = output.band_id;
    this.revision = output.revision;
    this.template_version = output.template_version;
    this.status = output.status;
    this.contractor = output.contractor;
    this.contracted = output.contracted;
    this.clauses = output.clauses;
    this.variables = output.variables;
    this.signatures = output.signatures;
    this.content_hash = output.content_hash;
    this.verification_code = output.verification_code;
    this.has_document = output.has_document;
    this.has_certificate = output.has_certificate;
    this.pending_signatures = output.pending_signatures;
    this.issued_at = output.issued_at;
    this.signed_at = output.signed_at;
    this.annulled_at = output.annulled_at;
    this.annul_reason = output.annul_reason;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class ContractCollectionPresenter extends CollectionPresenter {
  data: ContractPresenter[];

  constructor(output: {
    items: ContractOutput[];
    total: number;
    current_page: number;
    last_page: number;
    per_page: number;
  }) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((item) => new ContractPresenter(item));
  }
}

/**
 * Resposta da rota pública de verificação.
 *
 * Allowlist campo a campo, nunca omissão dos sensíveis: aqui não há cláusula,
 * valor, documento nem endereço, e os nomes saem mascarados. Serve a quem tem o
 * PDF em mãos e quer conferir; não serve para colher dados de ninguém.
 */
export class ContractVerificationPresenter {
  @ApiProperty()
  verification_code: string;

  @ApiProperty({ enum: ["issued", "partially_signed", "signed", "annulled"] })
  status: string;

  @ApiProperty()
  template_version: string;

  @ApiProperty({
    description:
      "SHA-256 do conteúdo. Confira contra o valor impresso no rodapé do documento.",
  })
  content_hash: string;

  @ApiProperty({ example: "Bar do Z." })
  contractor_name: string;

  @ApiProperty({ example: "Ana R." })
  contracted_name: string;

  @ApiProperty({ example: "12 de setembro de 2026" })
  show_date: string;

  @Transform(({ value }: { value: Date }) => value?.toISOString())
  @ApiProperty({ format: "date-time" })
  issued_at: Date;

  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  @ApiProperty({ format: "date-time", nullable: true })
  signed_at: Date | null;

  constructor(output: ContractVerificationOutput) {
    this.verification_code = output.verification_code;
    this.status = output.status;
    this.template_version = output.template_version;
    this.content_hash = output.content_hash;
    this.contractor_name = output.contractor_name;
    this.contracted_name = output.contracted_name;
    this.show_date = output.show_date;
    this.issued_at = output.issued_at;
    this.signed_at = output.signed_at;
  }
}

/**
 * Resposta do pedido de código de assinatura.
 *
 * 🔴 **Não tem campo para o código, e isso é a garantia.** O presenter copia
 * campo a campo (allowlist), então acrescentar o código exigiria uma linha
 * deliberada aqui — não acontece por descuido de espalhar o output inteiro.
 */
export class SignatureChallengePresenter {
  role: "contractor" | "contracted";
  /** `a****@exemplo.com` — confirma o destino sem expor o e-mail. */
  destination_masked: string;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  expires_at: Date;

  constructor(output: {
    role: "contractor" | "contracted";
    destination_masked: string;
    expires_at: Date;
  }) {
    this.role = output.role;
    this.destination_masked = output.destination_masked;
    this.expires_at = output.expires_at;
  }
}

/**
 * Resultado da entrega do contrato por e-mail.
 *
 * Diz o que aconteceu sem expor destino: a parte já sabe o próprio e-mail, e
 * `failed` carrega o papel, não a caixa.
 */
export class ContractDeliveryPresenter {
  delivered: ("contractor" | "contracted")[];
  failed: { role: "contractor" | "contracted"; reason: string }[];
  document_available: boolean;

  constructor(output: {
    delivered: ("contractor" | "contracted")[];
    failed: { role: "contractor" | "contracted"; reason: string }[];
    document_available: boolean;
  }) {
    this.delivered = output.delivered;
    this.failed = output.failed;
    this.document_available = output.document_available;
  }
}
