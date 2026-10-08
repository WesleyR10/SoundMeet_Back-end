import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { ValueObject } from "../../../shared/domain/value-object";
import {
  ContractIpSource,
  ContractPartyRole,
  ContractSignatureMethod,
} from "../contract-types";

/**
 * Um aceite eletrônico, com a trilha que o sustenta.
 *
 * A validade jurídica da assinatura eletrônica não-ICP vem da MP 2.200-2/2001,
 * art. 10, §2º: vale entre as partes que a admitirem como válida. Duas coisas a
 * sustentam na prática, e as duas moram aqui:
 *
 *  1. **autoria** — quem assinou foi autenticado pelo Keycloak, e o nome e o
 *     documento vêm do snapshot congelado da parte, nunca do corpo da
 *     requisição (aceitar identidade do cliente permitiria assinar com nome
 *     alheio);
 *  2. **inequivocidade do consentimento** — `accepted_terms` só é verdadeiro
 *     por um aceite explícito e dedicado, nunca por navegação.
 *
 * A integridade do que foi assinado não mora aqui: mora no `content_hash` do
 * agregado, calculado sobre o conteúdo congelado.
 */

export type ContractSignatureProps = {
  role: ContractPartyRole;
  /** Nome do signatário — copiado da parte congelada, não do input. */
  signer_name: string;
  /**
   * Só dígitos. CPF de quem assinou (o representante, quando houver) —
   * **`null` quando a plataforma não conhece o documento**.
   *
   * ⚠️ O CPF não é a âncora de identidade desta assinatura: `signer_user_id` é.
   * O documento é dado declarado no cadastro; a conta é autenticada pelo
   * Keycloak no instante do aceite. Tratar o CPF como obrigatório levaria a
   * fabricá-lo quando ausente — que é exatamente o que não se pode fazer num
   * instrumento probatório.
   */
  signer_document: string | null;
  signer_email: string;
  /**
   * `sub` do JWT — a identidade autenticada por trás do aceite, e o elo mais
   * forte da trilha.
   */
  signer_user_id: string;
  signed_at: Date;
  method: ContractSignatureMethod;
  /** O IP que o servidor enxergou. Pode ser o do BFF — ver `ip_source`. */
  ip: string | null;
  /**
   * 🔴 Procedência do IP. Todo o `soundmeet-web` sai de um IP só, então
   * `proxied` significa "este é o IP do nosso BFF, não o do signatário".
   * Registrar a procedência é o que impede a trilha de afirmar mais do que sabe.
   */
  ip_source: ContractIpSource;
  /** `X-Forwarded-For` cru, sem interpretação. Guardado, nunca confiado. */
  forwarded_for?: string | null;
  user_agent?: string | null;
};

export type ContractSignatureJSON = {
  role: ContractPartyRole;
  signer_name: string;
  signer_document: string | null;
  signer_email: string;
  signer_user_id: string;
  signed_at: string;
  method: ContractSignatureMethod;
  ip: string | null;
  ip_source: ContractIpSource;
  forwarded_for: string | null;
  user_agent: string | null;
};

const MAX_USER_AGENT_LENGTH = 512;
const MAX_FORWARDED_FOR_LENGTH = 512;

export class ContractSignature extends ValueObject {
  readonly role: ContractPartyRole;
  readonly signer_name: string;
  readonly signer_document: string | null;
  readonly signer_email: string;
  readonly signer_user_id: string;
  readonly signed_at: Date;
  readonly method: ContractSignatureMethod;
  readonly ip: string | null;
  readonly ip_source: ContractIpSource;
  readonly forwarded_for: string | null;
  readonly user_agent: string | null;

  constructor(props: ContractSignatureProps) {
    super();
    this.role = props.role;
    this.signer_name = ContractSignature.normalizeText(props.signer_name) ?? "";
    this.signer_document = ContractSignature.normalizeDocument(
      props.signer_document,
    );
    this.signer_email =
      ContractSignature.normalizeText(props.signer_email)?.toLowerCase() ?? "";
    this.signer_user_id =
      ContractSignature.normalizeText(props.signer_user_id) ?? "";
    this.signed_at = props.signed_at;
    this.method = props.method;
    this.ip = ContractSignature.normalizeText(props.ip);
    this.ip_source = props.ip_source;
    this.forwarded_for = ContractSignature.truncate(
      ContractSignature.normalizeText(props.forwarded_for),
      MAX_FORWARDED_FOR_LENGTH,
    );
    this.user_agent = ContractSignature.truncate(
      ContractSignature.normalizeText(props.user_agent),
      MAX_USER_AGENT_LENGTH,
    );

    this.validate();
  }

  toJSON(): ContractSignatureJSON {
    return {
      role: this.role,
      signer_name: this.signer_name,
      signer_document: this.signer_document,
      signer_email: this.signer_email,
      signer_user_id: this.signer_user_id,
      signed_at: this.signed_at.toISOString(),
      method: this.method,
      ip: this.ip,
      ip_source: this.ip_source,
      forwarded_for: this.forwarded_for,
      user_agent: this.user_agent,
    };
  }

  static fromJSON(json: any): ContractSignature {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new InvalidContractSignatureError(
        "Invalid JSON for ContractSignature",
      );
    }

    const signedAt = new Date(json.signed_at);
    if (Number.isNaN(signedAt.getTime())) {
      throw new InvalidContractSignatureError("Invalid signature timestamp");
    }

    return new ContractSignature({
      role: json.role,
      signer_name: json.signer_name,
      signer_document: json.signer_document,
      signer_email: json.signer_email,
      signer_user_id: json.signer_user_id,
      signed_at: signedAt,
      method: json.method,
      ip: json.ip,
      ip_source: json.ip_source,
      forwarded_for: json.forwarded_for,
      user_agent: json.user_agent,
    });
  }

  private validate(): void {
    if (this.role !== "contractor" && this.role !== "contracted") {
      throw new InvalidContractSignatureError(
        `Invalid signature role: ${this.role}`,
      );
    }

    if (!this.signer_name) {
      throw new InvalidContractSignatureError("Signer name is required");
    }

    // Documento é opcional (ver docblock da prop): a identidade vem de
    // `signer_user_id`. Mas, se vier, vem certo.
    if (this.signer_document !== null && this.signer_document.length !== 11) {
      throw new InvalidContractSignatureError("Signer CPF must have 11 digits");
    }

    if (!this.signer_user_id) {
      throw new InvalidContractSignatureError(
        "Signer user id is required — a signature without an authenticated identity proves nothing",
      );
    }

    if (Number.isNaN(this.signed_at?.getTime?.())) {
      throw new InvalidContractSignatureError("Invalid signature timestamp");
    }

    if (this.method !== "platform_acceptance") {
      throw new InvalidContractSignatureError(
        `Unknown signature method: ${this.method}`,
      );
    }

    if (
      this.ip_source !== "direct" &&
      this.ip_source !== "proxied" &&
      this.ip_source !== "unknown"
    ) {
      throw new InvalidContractSignatureError(
        `Invalid ip source: ${this.ip_source}`,
      );
    }
  }

  private static normalizeDocument(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const digits = value.replace(/\D/g, "");
    return digits.length === 0 ? null : digits;
  }

  private static normalizeText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private static truncate(
    value: string | null,
    maxLength: number,
  ): string | null {
    if (value === null) return null;
    return value.length > maxLength ? value.slice(0, maxLength) : value;
  }
}

export class InvalidContractSignatureError extends InvalidArgumentError {
  constructor(message?: string) {
    super(message ?? "Invalid contract signature");
    this.name = "InvalidContractSignatureError";
  }
}
