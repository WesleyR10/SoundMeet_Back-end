import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { ValueObject } from "../../../shared/domain/value-object";
import { ContractPartyKind, ContractPartyRole } from "../contract-types";

/**
 * Qualificação de uma parte, **congelada no momento da emissão**.
 *
 * Não é uma referência ao agregado `Musician`/`Establishment` — é uma cópia. Se
 * o bar mudar de endereço ou o músico corrigir o nome depois, o contrato assinado
 * continua dizendo o que dizia quando foi assinado. Um documento que muda sozinho
 * não prova nada, e é por isso que aqui não há id de agregado: quem quiser o
 * estado atual consulta o agregado; quem quiser o que foi acordado lê o contrato.
 *
 * O checksum de CPF/CNPJ **já foi validado a montante** pelos VOs `CPF`/`CNPJ`
 * ao entrar no agregado de origem. Aqui a validação é de forma (dígitos e
 * comprimento), porque o VO precisa sobreviver a uma reidratação do JSON da
 * coluna sem depender de o dado ter vindo pelo caminho feliz.
 */

export type ContractPartyAddress = {
  street: string;
  number: string;
  complement?: string | null;
  neighborhood: string;
  city: string;
  /** UF — define a comarca do foro quando o show é no endereço do contratante. */
  state: string;
  zip_code: string;
  country: string;
};

/**
 * Quem assina quando a parte não assina por si.
 *
 * Dois casos reais: estabelecimento pessoa jurídica (assina o representante
 * legal) e banda (assina o líder, na qualidade de representante dos
 * integrantes). Banda não tem personalidade jurídica — quem responde é uma
 * pessoa, e o contrato tem que dizer qual.
 */
export type ContractPartyRepresentative = {
  name: string;
  /**
   * Só dígitos. CPF do representante — **`null` quando não conhecido**.
   *
   * A plataforma não coleta o CPF do representante legal do estabelecimento
   * hoje. Deixar o campo opcional é o que permite emitir o contrato com a
   * verdade ("representante legal identificado no Anexo II") em vez de fabricar
   * um documento a partir do CNPJ — o que seria falsidade num instrumento cuja
   * única razão de existir é provar fatos.
   */
  document: string | null;
  /** Ex.: "representante legal", "líder da banda". */
  title: string;
};

export type ContractPartyProps = {
  role: ContractPartyRole;
  kind: ContractPartyKind;
  /** Nome civil (PF) ou razão social (PJ). É quem responde juridicamente. */
  legal_name: string;
  /** Nome fantasia, nome artístico ou nome da banda. Aparece, não responde. */
  display_name?: string | null;
  /** Só dígitos: 11 para `individual`, 14 para `company`. */
  document: string;
  email: string;
  phone?: string | null;
  address: ContractPartyAddress;
  representative?: ContractPartyRepresentative | null;
};

export type ContractPartyJSON = {
  role: ContractPartyRole;
  kind: ContractPartyKind;
  legal_name: string;
  display_name: string | null;
  document: string;
  email: string;
  phone: string | null;
  address: ContractPartyAddress;
  representative: ContractPartyRepresentative | null;
};

const CPF_DIGITS = 11;
const CNPJ_DIGITS = 14;
const MAX_NAME_LENGTH = 200;

export class ContractParty extends ValueObject {
  readonly role: ContractPartyRole;
  readonly kind: ContractPartyKind;
  readonly legal_name: string;
  readonly display_name: string | null;
  readonly document: string;
  readonly email: string;
  readonly phone: string | null;
  readonly address: ContractPartyAddress;
  readonly representative: ContractPartyRepresentative | null;

  constructor(props: ContractPartyProps) {
    super();
    this.role = props.role;
    this.kind = props.kind;
    this.legal_name = ContractParty.normalizeText(props.legal_name) ?? "";
    this.display_name = ContractParty.normalizeText(props.display_name);
    this.document = ContractParty.onlyDigits(props.document);
    this.email = ContractParty.normalizeText(props.email)?.toLowerCase() ?? "";
    this.phone = ContractParty.normalizeText(props.phone);
    this.address = ContractParty.normalizeAddress(props.address);
    this.representative = ContractParty.normalizeRepresentative(
      props.representative,
    );

    this.validate();
  }

  /** `123.456.789-01` ou `12.345.678/0001-90` — como um contrato escreve. */
  get formatted_document(): string {
    if (this.kind === "company") {
      return this.document.replace(
        /^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/,
        "$1.$2.$3/$4-$5",
      );
    }
    return this.document.replace(
      /^(\d{3})(\d{3})(\d{3})(\d{2})$/,
      "$1.$2.$3-$4",
    );
  }

  /** Endereço em uma linha, como aparece na qualificação das partes. */
  get formatted_address(): string {
    const { street, number, complement, neighborhood, city, state, zip_code } =
      this.address;
    const line = [
      `${street}, ${number}`,
      complement,
      neighborhood,
      `${city}/${state}`,
      `CEP ${zip_code}`,
    ].filter((part): part is string => Boolean(part && part.length > 0));

    return line.join(" — ");
  }

  /**
   * O nome que o documento usa para se referir à parte ao longo das cláusulas:
   * o nome artístico quando existe (é como o contratante conhece o artista),
   * caindo para o nome civil.
   */
  get reference_name(): string {
    return this.display_name ?? this.legal_name;
  }

  toJSON(): ContractPartyJSON {
    return {
      role: this.role,
      kind: this.kind,
      legal_name: this.legal_name,
      display_name: this.display_name,
      document: this.document,
      email: this.email,
      phone: this.phone,
      address: this.address,
      representative: this.representative,
    };
  }

  static fromJSON(json: any): ContractParty {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new InvalidContractPartyError("Invalid JSON for ContractParty");
    }

    return new ContractParty({
      role: json.role,
      kind: json.kind,
      legal_name: json.legal_name,
      display_name: json.display_name,
      document: json.document,
      email: json.email,
      phone: json.phone,
      address: json.address,
      representative: json.representative,
    });
  }

  private validate(): void {
    if (this.role !== "contractor" && this.role !== "contracted") {
      throw new InvalidContractPartyError(`Invalid party role: ${this.role}`);
    }

    if (this.kind !== "individual" && this.kind !== "company") {
      throw new InvalidContractPartyError(`Invalid party kind: ${this.kind}`);
    }

    ContractParty.assertName(this.legal_name, "legal_name");

    const expectedDigits = this.kind === "company" ? CNPJ_DIGITS : CPF_DIGITS;
    if (this.document.length !== expectedDigits) {
      throw new InvalidContractPartyError(
        `A ${this.kind === "company" ? "CNPJ" : "CPF"} must have ${expectedDigits} digits`,
      );
    }

    if (!this.email.includes("@")) {
      throw new InvalidContractPartyError("Invalid party email");
    }

    for (const field of [
      "street",
      "number",
      "neighborhood",
      "city",
      "state",
      "zip_code",
      "country",
    ] as const) {
      if (!this.address[field]) {
        throw new InvalidContractPartyError(
          `Party address is missing "${field}"`,
        );
      }
    }

    if (this.representative) {
      ContractParty.assertName(this.representative.name, "representative.name");
      // CPF do representante é opcional (ver docblock do tipo), mas se vier,
      // vem certo — documento com 7 dígitos é erro de digitação, não ausência.
      if (
        this.representative.document !== null &&
        this.representative.document.length !== CPF_DIGITS
      ) {
        throw new InvalidContractPartyError(
          "A representative CPF must have 11 digits",
        );
      }
      if (!this.representative.title) {
        throw new InvalidContractPartyError(
          "Party representative is missing a title",
        );
      }
    }

    /*
     * ⚠️ Pessoa jurídica NÃO exige representante nomeado na emissão.
     *
     * Empresa não assina — gente assina por ela —, mas a plataforma não coleta
     * hoje o nome e o CPF do representante legal do estabelecimento: quem opera
     * a conta é quem assina, e a identidade dele é provada pelo Keycloak no
     * momento do aceite, não no cadastro.
     *
     * Exigir o representante aqui deixaria o contrato inalcançável para todo
     * estabelecimento já cadastrado; e preenchê-lo com um dado derivado (por
     * exemplo, os primeiros dígitos do CNPJ) seria **fabricar documento** — o
     * pior desfecho possível num instrumento que existe para provar coisas.
     *
     * A saída honesta: quando não há representante nomeado, o documento diz
     * "neste ato representada por seu representante legal, identificado no
     * Anexo II", e o Anexo II traz quem de fato assinou, com conta autenticada,
     * e-mail, data, IP e agente de acesso.
     *
     * Coletar nome e CPF do representante no cadastro do estabelecimento é o
     * próximo incremento natural — e aí este campo passa a vir preenchido sem
     * nenhuma mudança aqui.
     */
  }

  private static assertName(value: string, field: string): void {
    if (!value || value.length < 2) {
      throw new InvalidContractPartyError(`Party "${field}" is required`);
    }
    if (value.length > MAX_NAME_LENGTH) {
      throw new InvalidContractPartyError(
        `Party "${field}" must be at most ${MAX_NAME_LENGTH} characters`,
      );
    }
  }

  private static onlyDigits(value: unknown): string {
    return typeof value === "string" ? value.replace(/\D/g, "") : "";
  }

  private static normalizeText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  private static normalizeAddress(address: any): ContractPartyAddress {
    if (!address || typeof address !== "object" || Array.isArray(address)) {
      throw new InvalidContractPartyError("Party address is required");
    }

    return {
      street: ContractParty.normalizeText(address.street) ?? "",
      number: ContractParty.normalizeText(address.number) ?? "",
      complement: ContractParty.normalizeText(address.complement),
      neighborhood: ContractParty.normalizeText(address.neighborhood) ?? "",
      city: ContractParty.normalizeText(address.city) ?? "",
      state: ContractParty.normalizeText(address.state)?.toUpperCase() ?? "",
      zip_code: ContractParty.onlyDigits(address.zip_code).replace(
        /^(\d{5})(\d{3})$/,
        "$1-$2",
      ),
      country: ContractParty.normalizeText(address.country) ?? "Brasil",
    };
  }

  private static normalizeRepresentative(
    representative: any,
  ): ContractPartyRepresentative | null {
    if (
      !representative ||
      typeof representative !== "object" ||
      Array.isArray(representative)
    ) {
      return null;
    }

    const document = ContractParty.onlyDigits(representative.document);

    return {
      name: ContractParty.normalizeText(representative.name) ?? "",
      // String vazia e `null` significam a mesma coisa aqui — "não informado" —
      // e guardar as duas formas faria o mapper e o PDF terem que checar as duas.
      document: document.length === 0 ? null : document,
      title: ContractParty.normalizeText(representative.title) ?? "",
    };
  }
}

export class InvalidContractPartyError extends InvalidArgumentError {
  constructor(message?: string) {
    super(message ?? "Invalid contract party");
    this.name = "InvalidContractPartyError";
  }
}
