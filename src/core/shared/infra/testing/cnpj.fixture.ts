/**
 * Gera CNPJs sintaticamente válidos para testes.
 *
 * Mesmo motivo do `cpf.fixture.ts`: `Musician.cnpj` e `Establishment.cnpj` são
 * `@unique`, então testes que criam mais de uma parte não podem reusar uma
 * constante fixa. O valor precisa passar pelos dígitos verificadores do VO
 * `CNPJ` (`core/shared/domain/value-objects/cnpj.vo.ts`) — um número aleatório
 * qualquer seria recusado.
 *
 * Só para testes: nunca use isto em código de produção.
 */

const FIRST_WEIGHTS = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
const SECOND_WEIGHTS = [6, ...FIRST_WEIGHTS];

function checkDigit(digits: number[], weights: number[]): number {
  const sum = digits.reduce(
    (acc, digit, index) => acc + digit * weights[index],
    0,
  );
  const remainder = sum % 11;
  return remainder < 2 ? 0 : 11 - remainder;
}

/**
 * @param base 12 dígitos-base (raiz + filial). Omitido, sorteia a raiz e usa a
 *   filial `0001` — mas evite depender do acaso quando o teste precisa de um
 *   valor estável; prefira passar a base.
 */
export function generateValidCnpj(base?: string): string {
  const digits = base
    ? base
        .replace(/\D/g, "")
        .padStart(12, "0")
        .slice(0, 12)
        .split("")
        .map(Number)
    : [
        ...Array.from({ length: 8 }, () => Math.floor(Math.random() * 10)),
        0,
        0,
        0,
        1,
      ];

  // Sequência repetida (11.111.111/1111-11 etc.) é recusada pelo VO mesmo com
  // os dígitos verificadores corretos — desempata mexendo no primeiro dígito.
  if (digits.every((d) => d === digits[0])) {
    digits[0] = (digits[0] + 1) % 10;
  }

  const first = checkDigit(digits, FIRST_WEIGHTS);
  const second = checkDigit([...digits, first], SECOND_WEIGHTS);
  return [...digits, first, second].join("");
}
