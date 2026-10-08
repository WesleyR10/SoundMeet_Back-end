import { createHash } from "node:crypto";

import { AggregateRoot, Uuid } from "../../shared/domain";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { ContractValidatorFactory } from "./contract.validator";
import { ContractFakeBuilder } from "./contract-fake.builder";
import { ContractPartyRole, ContractStatus } from "./contract-types";
import { ContractAnnulledEvent } from "./events/contract-annulled.event";
import { ContractIssuedEvent } from "./events/contract-issued.event";
import { ContractSignedEvent } from "./events/contract-signed.event";
import { ContractParty } from "./value-objects/contract-party.vo";
import { ContractSignature } from "./value-objects/contract-signature.vo";
import { ContractVariables } from "./value-objects/contract-variables.vo";
import { RenderedClause } from "./value-objects/rendered-clause.vo";

// Reexporta para não obrigar quem usa o agregado a importar de dois lugares.
export * from "./contract-types";

export class ContractId extends Uuid {}

export type ContractConstructorProps = {
  contract_id?: ContractId;
  booking_id: Uuid;
  establishment_id: Uuid;
  musician_id?: Uuid | null;
  band_id?: Uuid | null;
  revision?: number;
  template_version: string;
  status?: ContractStatus;
  contractor: ContractParty;
  contracted: ContractParty;
  clauses: RenderedClause[];
  variables: ContractVariables;
  signatures?: ContractSignature[];
  content_hash: string;
  verification_code: string;
  document_key?: string | null;
  certificate_key?: string | null;
  issued_at?: Date;
  signed_at?: Date | null;
  annulled_at?: Date | null;
  annul_reason?: string | null;
  created_at?: Date;
  updated_at?: Date;
};

export type ContractCreateCommand = {
  booking_id: string;
  establishment_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  revision?: number;
  template_version: string;
  contractor: ContractParty;
  contracted: ContractParty;
  clauses: RenderedClause[];
  variables: ContractVariables;
  verification_code: string;
  document_key?: string | null;
  issued_at?: Date;
};

export type ContractSignCommand = {
  role: ContractPartyRole;
  /** `sub` do JWT de quem assinou. Prova a identidade autenticada. */
  signer_user_id: string;
  signed_at: Date;
  ip: string | null;
  ip_source: "direct" | "proxied" | "unknown";
  forwarded_for?: string | null;
  user_agent?: string | null;
};

/**
 * Contrato de apresentação musical **emitido**.
 *
 * ## O que este agregado garante
 *
 * **Imutabilidade do conteúdo.** `clauses`, `variables`, `contractor` e
 * `contracted` são `readonly` e não têm mutador. Isso não é convenção — é
 * ausência de API: não existe caminho no código que reescreva o que foi
 * assinado. Rerender é proibido; alteração exige termo aditivo, que é um
 * contrato novo com `revision` maior.
 *
 * **Integridade verificável.** `content_hash` é o SHA-256 de uma serialização
 * canônica do conteúdo congelado — nunca dos bytes do PDF, que carregam
 * metadados voláteis e não são determinísticos. Mesma ideia do
 * `chord-sheet-fingerprint.ts`: string canônica, campos voláteis de fora.
 *
 * **Contrato assinado é prova, não estado descartável.** `annul()` recusa
 * contrato `signed`. Se o show for cancelado depois da assinatura, o contrato
 * permanece assinado e o cancelamento é fato registrado no `Booking` — anular
 * destruiria justamente a evidência que o documento existe para produzir.
 */
export class Contract extends AggregateRoot {
  contract_id: ContractId;
  readonly booking_id: Uuid;
  readonly establishment_id: Uuid;
  readonly musician_id: Uuid | null;
  readonly band_id: Uuid | null;
  readonly revision: number;
  readonly template_version: string;
  status: ContractStatus;
  readonly contractor: ContractParty;
  readonly contracted: ContractParty;
  readonly clauses: RenderedClause[];
  readonly variables: ContractVariables;
  signatures: ContractSignature[];
  readonly content_hash: string;
  readonly verification_code: string;
  readonly document_key: string | null;
  certificate_key: string | null;
  readonly issued_at: Date;
  signed_at: Date | null;
  annulled_at: Date | null;
  annul_reason: string | null;
  created_at: Date;
  updated_at: Date;

  constructor(props: ContractConstructorProps) {
    super();
    this.contract_id = props.contract_id ?? new ContractId();
    this.booking_id = props.booking_id;
    this.establishment_id = props.establishment_id;
    this.musician_id = props.musician_id ?? null;
    this.band_id = props.band_id ?? null;
    this.revision = props.revision ?? 1;
    this.template_version = props.template_version;
    this.status = props.status ?? "issued";
    this.contractor = props.contractor;
    this.contracted = props.contracted;
    this.clauses = props.clauses;
    this.variables = props.variables;
    this.signatures = props.signatures ?? [];
    this.content_hash = props.content_hash;
    this.verification_code = props.verification_code;
    this.document_key = props.document_key ?? null;
    this.certificate_key = props.certificate_key ?? null;
    this.issued_at = props.issued_at ?? new Date();
    this.signed_at = props.signed_at ?? null;
    this.annulled_at = props.annulled_at ?? null;
    this.annul_reason = props.annul_reason ?? null;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): ContractId {
    return this.contract_id;
  }

  /**
   * Hash do conteúdo congelado.
   *
   * A serialização é **canônica**: ordem fixa de campos, cláusulas na ordem do
   * documento, nada de data de geração ou id aleatório. Duas emissões do mesmo
   * contexto produzem o mesmo hash — é o que permite a alguém conferir, a
   * partir do documento em mãos, que nada foi alterado.
   */
  static computeContentHash(input: {
    template_version: string;
    contractor: ContractParty;
    contracted: ContractParty;
    variables: ContractVariables;
    clauses: RenderedClause[];
  }): string {
    const canonical = JSON.stringify({
      template_version: input.template_version,
      contractor: input.contractor.toJSON(),
      contracted: input.contracted.toJSON(),
      variables: input.variables.toJSON(),
      clauses: input.clauses.map((clause) => clause.toJSON()),
    });

    return createHash("sha256").update(canonical, "utf8").digest("hex");
  }

  static create(command: ContractCreateCommand): Contract {
    const content_hash = Contract.computeContentHash({
      template_version: command.template_version,
      contractor: command.contractor,
      contracted: command.contracted,
      variables: command.variables,
      clauses: command.clauses,
    });

    const contract = new Contract({
      booking_id: new Uuid(command.booking_id),
      establishment_id: new Uuid(command.establishment_id),
      musician_id: command.musician_id ? new Uuid(command.musician_id) : null,
      band_id: command.band_id ? new Uuid(command.band_id) : null,
      revision: command.revision ?? 1,
      template_version: command.template_version,
      status: "issued",
      contractor: command.contractor,
      contracted: command.contracted,
      clauses: command.clauses,
      variables: command.variables,
      content_hash,
      verification_code: command.verification_code,
      document_key: command.document_key ?? null,
      issued_at: command.issued_at ?? new Date(),
    });

    contract.validate();

    if (contract.notification.hasErrors()) {
      throw new EntityValidationError(contract.notification.toJSON());
    }

    contract.applyEvent(
      new ContractIssuedEvent({
        aggregate_id: contract.contract_id,
        booking_id: contract.booking_id,
        establishment_id: contract.establishment_id,
        musician_id: contract.musician_id,
        band_id: contract.band_id,
        template_version: contract.template_version,
        issued_at: contract.issued_at,
      }),
    );

    return contract;
  }

  validate(fields?: string[]): void {
    const validator = ContractValidatorFactory.create();
    validator.validate(this.notification, this, fields);

    // XOR musician/band — espelha `Booking`. Um contrato precisa saber quem é o
    // contratado, e "os dois" é tão inválido quanto "nenhum".
    const hasMusician = Boolean(this.musician_id);
    const hasBand = Boolean(this.band_id);
    if (hasMusician === hasBand) {
      this.notification.addError(
        "Either musician_id or band_id must be provided (exclusively)",
        "target",
      );
    }

    if (this.clauses.length === 0) {
      this.notification.addError(
        "Um contrato não pode ser emitido sem cláusulas",
        "clauses",
      );
    }

    const numbers = this.clauses.map((clause) => clause.number);
    const esperado = numbers.every((value, index) => value === index + 1);
    if (!esperado) {
      this.notification.addError(
        "As cláusulas devem estar numeradas sequencialmente a partir de 1",
        "clauses",
      );
    }
  }

  /** A assinatura pendente daquele lado, ou `null` se já assinou. */
  signatureOf(role: ContractPartyRole): ContractSignature | null {
    return this.signatures.find((signature) => signature.role === role) ?? null;
  }

  get isFullySigned(): boolean {
    return (
      this.signatureOf("contractor") !== null &&
      this.signatureOf("contracted") !== null
    );
  }

  partyOf(role: ContractPartyRole): ContractParty {
    return role === "contractor" ? this.contractor : this.contracted;
  }

  /**
   * Registra o aceite de um dos lados.
   *
   * Nome e documento do signatário são **copiados da parte congelada**, nunca
   * recebidos do chamador: aceitar identidade vinda do cliente permitiria
   * assinar com nome alheio. O que o chamador traz é só a prova de contexto —
   * quem estava autenticado, quando, de onde.
   *
   * Quem representa a parte (representante legal da PJ, líder da banda) é quem
   * consta como signatário; na ausência de representante, a própria parte.
   */
  sign(command: ContractSignCommand): void {
    if (this.status === "annulled") {
      this.notification.addError(
        "Contrato anulado não pode ser assinado",
        "status",
      );
      return;
    }

    if (this.signatureOf(command.role)) {
      this.notification.addError(
        "Esta parte já assinou o contrato",
        "signatures",
      );
      return;
    }

    const party = this.partyOf(command.role);
    /*
     * Quem assina é o representante quando há um nomeado (líder da banda,
     * representante legal); senão, a própria parte.
     *
     * `document` pode ser `null` — é o caso do estabelecimento pessoa jurídica,
     * cujo representante a plataforma ainda não coleta. A identidade da
     * assinatura não depende disso: ela vem de `signer_user_id`, a conta
     * autenticada. Preencher o CPF com algo derivado seria fabricar documento.
     */
    const signer = party.representative ?? {
      name: party.legal_name,
      /*
       * Só pessoa FÍSICA assina com o documento da própria parte. O de pessoa
       * jurídica é CNPJ, e `signer_document` é CPF: copiá-lo fazia o
       * `ContractSignature` lançar e o músico MEI não conseguia assinar o
       * próprio contrato. O CPF de quem assinou pela PJ não é conhecido aqui —
       * `null`, pela regra do parágrafo acima.
       */
      document: party.kind === "individual" ? party.document : null,
    };

    const signature = new ContractSignature({
      role: command.role,
      signer_name: signer.name,
      signer_document: signer.document,
      signer_email: party.email,
      signer_user_id: command.signer_user_id,
      signed_at: command.signed_at,
      method: "platform_acceptance",
      ip: command.ip,
      ip_source: command.ip_source,
      forwarded_for: command.forwarded_for ?? null,
      user_agent: command.user_agent ?? null,
    });

    this.signatures = [...this.signatures, signature];
    this.updated_at = command.signed_at;

    if (this.isFullySigned) {
      this.status = "signed";
      this.signed_at = command.signed_at;
      this.applyEvent(
        new ContractSignedEvent({
          aggregate_id: this.contract_id,
          booking_id: this.booking_id,
          signed_at: command.signed_at,
        }),
      );
      return;
    }

    this.status = "partially_signed";
  }

  /**
   * Anexa o certificado de assinatura.
   *
   * É o **único** mutador de documento depois da emissão, e existe porque o
   * certificado só pode nascer depois: ele contém a trilha das duas
   * assinaturas. Separar em dois arquivos é o que preserva a imutabilidade do
   * contrato — é assim que Clicksign e DocuSign também fazem.
   */
  attachCertificate(certificate_key: string): void {
    if (this.status !== "signed") {
      this.notification.addError(
        "O certificado de assinatura só existe após a assinatura de ambas as partes",
        "certificate_key",
      );
      return;
    }

    this.certificate_key = certificate_key;
    this.updated_at = new Date();
  }

  /**
   * Anula um contrato ainda não assinado por ambas as partes.
   *
   * 🔴 Recusa contrato `signed` de propósito. Contrato assinado é prova; anular
   * apagaria a evidência que ele existe para produzir. Show cancelado depois de
   * assinado permanece com o contrato assinado — o cancelamento é fato do
   * `Booking`, não do contrato.
   */
  annul(reason: string, now: Date): void {
    if (this.status === "signed") {
      this.notification.addError(
        "Contrato assinado não pode ser anulado — emita um termo aditivo",
        "status",
      );
      return;
    }

    if (this.status === "annulled") {
      this.notification.addError("Contrato já está anulado", "status");
      return;
    }

    const trimmed = reason?.trim() ?? "";
    if (trimmed.length === 0) {
      this.notification.addError(
        "Informe o motivo da anulação",
        "annul_reason",
      );
      return;
    }

    this.status = "annulled";
    this.annul_reason = trimmed;
    this.annulled_at = now;
    this.updated_at = now;

    this.applyEvent(
      new ContractAnnulledEvent({
        aggregate_id: this.contract_id,
        booking_id: this.booking_id,
        reason: trimmed,
        annulled_at: now,
      }),
    );
  }

  static fake(): typeof ContractFakeBuilder {
    return ContractFakeBuilder;
  }

  toJSON() {
    return {
      contract_id: this.contract_id.id,
      booking_id: this.booking_id.id,
      establishment_id: this.establishment_id.id,
      musician_id: this.musician_id?.id ?? null,
      band_id: this.band_id?.id ?? null,
      revision: this.revision,
      template_version: this.template_version,
      status: this.status,
      contractor: this.contractor.toJSON(),
      contracted: this.contracted.toJSON(),
      clauses: this.clauses.map((clause) => clause.toJSON()),
      variables: this.variables.toJSON(),
      signatures: this.signatures.map((signature) => signature.toJSON()),
      content_hash: this.content_hash,
      verification_code: this.verification_code,
      document_key: this.document_key,
      certificate_key: this.certificate_key,
      issued_at: this.issued_at,
      signed_at: this.signed_at,
      annulled_at: this.annulled_at,
      annul_reason: this.annul_reason,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
