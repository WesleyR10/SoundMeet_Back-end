import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";

/**
 * Utilitários usados **dentro** do corpo das cláusulas.
 *
 * ⚠️ **Nenhuma cláusula pode referenciar outra por número.** O documento é
 * montado dinamicamente — a numeração depende de quais variantes se aplicaram
 * àquele contrato —, então "nos termos da Cláusula 7ª" apontaria para cláusulas
 * diferentes em contratos diferentes. Referência cruzada, quando necessária, é
 * sempre pelo **nome** da cláusula ("na cláusula de cancelamento"), nunca pelo
 * número.
 */

/**
 * Exige que uma variável opcional esteja presente.
 *
 * Variante que declara `uses_escrow: true` sabe que o sinal existe, mas o tipo
 * continua sendo `number | null` — e um `null` interpolado viraria a palavra
 * "null" no meio de um contrato assinado. Falhar aqui, alto e com o nome da
 * variável, é o comportamento correto: contrato com buraco não é emitido.
 */
export function req<T>(value: T | null | undefined, name: string): T {
  if (value === null || value === undefined) {
    throw new MissingClauseVariableError(
      `A cláusula exige a variável "${name}", que não foi resolvida`,
    );
  }
  return value;
}

/** `["a","b","c"]` → `"a, b e c"`. Como um contrato lista integrantes. */
export function lista(items: readonly string[]): string {
  if (items.length === 0) {
    throw new MissingClauseVariableError(
      "A cláusula exige uma lista não vazia",
    );
  }
  if (items.length === 1) return items[0];
  return `${items.slice(0, -1).join(", ")} e ${items[items.length - 1]}`;
}

/** `1` → `"1 (um) dia"`; `5` → `"5 (cinco) dias"`. */
export function plural(
  quantidade: number,
  singular: string,
  pluralForma: string,
): string {
  return quantidade === 1 ? singular : pluralForma;
}

export class MissingClauseVariableError extends InvalidArgumentError {
  constructor(message?: string) {
    super(message ?? "Missing clause variable");
    this.name = "MissingClauseVariableError";
  }
}
