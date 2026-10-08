import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { ValueObject } from "../../../shared/domain/value-object";

/**
 * Uma cláusula **já renderizada** — texto final, sem variável por resolver.
 *
 * É a unidade do snapshot congelado. Depois da emissão o catálogo não é mais
 * consultado: um contrato de hoje renderiza igual daqui a cinco anos porque não
 * depende de nada além de si mesmo.
 *
 * ⚠️ **`key`, `variant_id` e `category` são `string`, não os tipos do catálogo —
 * de propósito.** Se fossem a união literal atual, remover uma cláusula do
 * catálogo quebraria a reidratação de todo contrato antigo que a contivesse, e
 * um documento assinado deixaria de carregar. O snapshot não pode depender do
 * vocabulário vigente; é a própria razão de ele existir.
 */

export type RenderedClauseProps = {
  /** Posição no documento, 1-based. É o número que a cláusula exibe. */
  number: number;
  key: string;
  variant_id: string;
  category: string;
  title: string;
  body: string;
};

export type RenderedClauseJSON = {
  number: number;
  key: string;
  variant_id: string;
  category: string;
  title: string;
  body: string;
};

const MAX_TITLE_LENGTH = 200;
const MAX_BODY_LENGTH = 20_000;

/**
 * Marcas de variável não resolvida. Se qualquer uma aparecer no corpo, o
 * contrato tem um buraco — e um contrato com buraco não pode ser emitido, muito
 * menos assinado. Barrar aqui, no VO, é o que garante que nenhum caminho
 * (catálogo novo, variante nova, teste esquecido) consiga produzir um documento
 * dizendo "undefined" para o cliente.
 */
const UNRESOLVED_MARKERS = ["undefined", "NaN", "[object Object]", "{{"];

export class RenderedClause extends ValueObject {
  readonly number: number;
  readonly key: string;
  readonly variant_id: string;
  readonly category: string;
  readonly title: string;
  readonly body: string;

  constructor(props: RenderedClauseProps) {
    super();
    this.number = props.number;
    this.key = RenderedClause.normalizeText(props.key) ?? "";
    this.variant_id = RenderedClause.normalizeText(props.variant_id) ?? "";
    this.category = RenderedClause.normalizeText(props.category) ?? "";
    this.title = RenderedClause.normalizeText(props.title) ?? "";
    this.body = RenderedClause.normalizeBody(props.body);

    this.validate();
  }

  toJSON(): RenderedClauseJSON {
    return {
      number: this.number,
      key: this.key,
      variant_id: this.variant_id,
      category: this.category,
      title: this.title,
      body: this.body,
    };
  }

  static fromJSON(json: any): RenderedClause {
    if (!json || typeof json !== "object" || Array.isArray(json)) {
      throw new InvalidRenderedClauseError("Invalid JSON for RenderedClause");
    }

    return new RenderedClause({
      number: json.number,
      key: json.key,
      variant_id: json.variant_id,
      category: json.category,
      title: json.title,
      body: json.body,
    });
  }

  private validate(): void {
    if (!Number.isInteger(this.number) || this.number < 1) {
      throw new InvalidRenderedClauseError(
        "Clause number must be a positive integer",
      );
    }

    for (const [field, value] of [
      ["key", this.key],
      ["variant_id", this.variant_id],
      ["category", this.category],
      ["title", this.title],
      ["body", this.body],
    ] as const) {
      if (!value) {
        throw new InvalidRenderedClauseError(`Clause "${field}" is required`);
      }
    }

    if (this.title.length > MAX_TITLE_LENGTH) {
      throw new InvalidRenderedClauseError(
        `Clause title must be at most ${MAX_TITLE_LENGTH} characters`,
      );
    }

    if (this.body.length > MAX_BODY_LENGTH) {
      throw new InvalidRenderedClauseError(
        `Clause body must be at most ${MAX_BODY_LENGTH} characters`,
      );
    }

    for (const marker of UNRESOLVED_MARKERS) {
      if (this.body.includes(marker) || this.title.includes(marker)) {
        throw new InvalidRenderedClauseError(
          `Clause "${this.key}" has an unresolved value ("${marker}") — it cannot be issued`,
        );
      }
    }
  }

  private static normalizeText(value: unknown): string | null {
    if (typeof value !== "string") return null;
    const trimmed = value.trim();
    return trimmed.length === 0 ? null : trimmed;
  }

  /**
   * Reflui o corpo em parágrafos.
   *
   * As cláusulas são escritas como template literal indentado no código-fonte,
   * o que significa que o texto chega aqui com a indentação do arquivo e com
   * quebras de linha na coluna 80 do EDITOR — que não têm nada a ver com onde
   * o texto deve quebrar no documento. Preservá-las produziria parágrafos
   * esfarrapados no PDF e no HTML, porque os dois refluem sozinhos.
   *
   * A regra é a do texto corrido: **linha em branco separa parágrafo; dentro do
   * parágrafo, quebra de linha é só espaço.** Some junto o espaço duplo que
   * sobra de interpolação condicional (`${cond ? "e aos integrantes" : ""}`) —
   * que num documento jurídico parece exatamente o que é, um erro de montagem.
   */
  private static normalizeBody(value: unknown): string {
    if (typeof value !== "string") return "";

    return value
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
      .filter((paragraph) => paragraph.length > 0)
      .join("\n\n");
  }
}

export class InvalidRenderedClauseError extends InvalidArgumentError {
  constructor(message?: string) {
    super(message ?? "Invalid rendered clause");
    this.name = "InvalidRenderedClauseError";
  }
}
