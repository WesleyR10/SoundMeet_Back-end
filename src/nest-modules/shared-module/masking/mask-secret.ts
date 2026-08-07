const DEFAULT_VISIBLE_CHARS = 4;

/**
 * Mascara um segredo mantendo só os últimos N caracteres visíveis (SM-016) —
 * usado em presenters HTTP para nunca devolver PIX key / dado bancário
 * completo, mesmo em rotas já protegidas por ownership guard (defesa em
 * profundidade: se o guard for mal configurado no futuro, o vazamento fica
 * limitado ao sufixo).
 */
export function maskSecretTail(
  value: string | null | undefined,
  visibleChars: number = DEFAULT_VISIBLE_CHARS,
): string | null {
  if (!value) return null;
  if (value.length <= visibleChars) return "*".repeat(value.length);
  return "*".repeat(value.length - visibleChars) + value.slice(-visibleChars);
}

/**
 * `bank_account` ainda não tem um shape fixo no domínio (campo `Json?`
 * placeholder) — mascara genericamente qualquer string-folha do objeto, sem
 * assumir nomes de campo específicos, para já vir seguro quando o shape for
 * definido.
 */
export function maskBankAccount(value: unknown): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value === "string") return maskSecretTail(value);
  if (Array.isArray(value)) return value.map((v) => maskBankAccount(v));
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      result[key] = maskBankAccount(v);
    }
    return result;
  }
  return value;
}
