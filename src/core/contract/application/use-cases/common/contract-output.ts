import { Contract } from "../../../domain/contract.aggregate";
import {
  ContractPartyRole,
  ContractStatus,
} from "../../../domain/contract-types";
import { ContractPartyJSON } from "../../../domain/value-objects/contract-party.vo";
import { ContractSignatureJSON } from "../../../domain/value-objects/contract-signature.vo";
import { ContractVariablesJSON } from "../../../domain/value-objects/contract-variables.vo";
import { RenderedClauseJSON } from "../../../domain/value-objects/rendered-clause.vo";

/**
 * Saída completa do contrato — para quem é parte.
 *
 * Devolve o snapshot inteiro de propósito: é ele que a UI renderiza como
 * documento nativo (HTML no web, lista de cláusulas no mobile), em vez de
 * embutir um PDF num `iframe`. O PDF é derivado; a fonte é isto.
 *
 * ⚠️ `document_key`/`certificate_key` **não saem daqui**. São chaves de storage
 * privado e não têm utilidade para o cliente — o download passa por
 * `GET /contracts/:contract_id/document`, que autoriza e faz stream. Expor a
 * chave transformaria a rota autorizada em teatro.
 */
export type ContractOutput = {
  id: string;
  booking_id: string;
  establishment_id: string;
  musician_id: string | null;
  band_id: string | null;
  revision: number;
  template_version: string;
  status: ContractStatus;
  contractor: ContractPartyJSON;
  contracted: ContractPartyJSON;
  clauses: RenderedClauseJSON[];
  variables: ContractVariablesJSON;
  signatures: ContractSignatureJSON[];
  content_hash: string;
  verification_code: string;
  /** `true` quando o documento renderizado está disponível para download. */
  has_document: boolean;
  has_certificate: boolean;
  /** Quais lados ainda não assinaram — evita o cliente recalcular a regra. */
  pending_signatures: ContractPartyRole[];
  issued_at: Date;
  signed_at: Date | null;
  annulled_at: Date | null;
  annul_reason: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * Saída pública da verificação por código.
 *
 * Allowlist campo a campo, nunca omissão dos sensíveis — é a regra do projeto,
 * e aqui ela é literal: os nomes saem **mascarados** e não há cláusula, valor,
 * documento nem endereço. O suficiente para um terceiro conferir que o PDF em
 * mãos corresponde a um contrato real e íntegro; insuficiente para colher dados
 * de quem quer que seja.
 */
export type ContractVerificationOutput = {
  verification_code: string;
  status: ContractStatus;
  template_version: string;
  content_hash: string;
  contractor_name: string;
  contracted_name: string;
  show_date: string;
  issued_at: Date;
  signed_at: Date | null;
};

export class ContractOutputMapper {
  static toOutput(entity: Contract): ContractOutput {
    const roles: ContractPartyRole[] = ["contractor", "contracted"];

    return {
      id: entity.contract_id.id,
      booking_id: entity.booking_id.id,
      establishment_id: entity.establishment_id.id,
      musician_id: entity.musician_id?.id ?? null,
      band_id: entity.band_id?.id ?? null,
      revision: entity.revision,
      template_version: entity.template_version,
      status: entity.status,
      contractor: entity.contractor.toJSON(),
      contracted: entity.contracted.toJSON(),
      clauses: entity.clauses.map((clause) => clause.toJSON()),
      variables: entity.variables.toJSON(),
      signatures: entity.signatures.map((signature) => signature.toJSON()),
      content_hash: entity.content_hash,
      verification_code: entity.verification_code,
      has_document: Boolean(entity.document_key),
      has_certificate: Boolean(entity.certificate_key),
      pending_signatures: roles.filter(
        (role) => entity.signatureOf(role) === null,
      ),
      issued_at: entity.issued_at,
      signed_at: entity.signed_at,
      annulled_at: entity.annulled_at,
      annul_reason: entity.annul_reason,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toVerificationOutput(entity: Contract): ContractVerificationOutput {
    return {
      verification_code: entity.verification_code,
      status: entity.status,
      template_version: entity.template_version,
      content_hash: entity.content_hash,
      contractor_name: ContractOutputMapper.maskName(
        entity.contractor.reference_name,
      ),
      contracted_name: ContractOutputMapper.maskName(
        entity.contracted.reference_name,
      ),
      show_date: entity.variables.data_show,
      issued_at: entity.issued_at,
      signed_at: entity.signed_at,
    };
  }

  /**
   * `"Ana Ribeiro"` → `"Ana R."`; `"Bar do Zé"` → `"Bar do Z."`.
   *
   * O primeiro nome inteiro e a inicial dos demais: quem tem o documento em
   * mãos reconhece as partes e confirma que é o contrato certo; quem só tem o
   * código não colhe nome completo de ninguém.
   */
  private static maskName(name: string): string {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "—";
    if (parts.length === 1) return parts[0];

    return [
      ...parts.slice(0, -1),
      `${parts[parts.length - 1].charAt(0).toUpperCase()}.`,
    ].join(" ");
  }
}
