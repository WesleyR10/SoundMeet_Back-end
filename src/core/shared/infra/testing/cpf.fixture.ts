/**
 * Gera CPFs sintaticamente válidos para testes.
 *
 * Existe porque `RegisterUseCase.assertCpfNotTaken` (anti multi-conta) rejeita
 * CPF repetido com 409, então testes que registram mais de um músico não podem
 * reusar uma constante fixa. O valor precisa passar pelos dígitos
 * verificadores do VO `CPF` (`core/shared/domain/value-objects/cpf.vo.ts`) —
 * um número aleatório qualquer seria recusado.
 *
 * Só para testes: nunca use isto em código de produção.
 */

function checkDigit(digits: number[]): number {
  const weightStart = digits.length + 1;
  const sum = digits.reduce(
    (acc, digit, index) => acc + digit * (weightStart - index),
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * @param base 9 dígitos-base. Omitido, sorteia — mas evite depender do acaso
 *   quando o teste precisa de um valor estável; prefira passar a base.
 */
export function generateValidCpf(base?: string): string {
  const digits = base
    ? base.replace(/\D/g, "").padStart(9, "0").slice(0, 9).split("").map(Number)
    : Array.from({ length: 9 }, () => Math.floor(Math.random() * 10));

  // Sequência repetida (111.111.111-11 etc.) é recusada pelo VO mesmo com os
  // dígitos verificadores corretos — desempata mexendo no primeiro dígito.
  if (digits.every((d) => d === digits[0])) {
    digits[0] = (digits[0] + 1) % 10;
  }

  const first = checkDigit(digits);
  const second = checkDigit([...digits, first]);
  return [...digits, first, second].join("");
}
