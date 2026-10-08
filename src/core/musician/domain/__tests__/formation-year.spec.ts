import { FORMATION_YEAR_MIN, isFormationYear } from "../formation-year";

/**
 * Ano de formação da banda (`bands.formed_in`).
 *
 * O teste que importa aqui é o do TETO: ele existe porque
 * `@Max(new Date().getFullYear())` congelaria o limite no carregamento do
 * módulo, e a falha resultante apareceria uma vez por ano, em produção, sem
 * teste nenhum quebrando.
 */
describe("isFormationYear", () => {
  const currentYear = new Date().getFullYear();

  test.each([FORMATION_YEAR_MIN, 1975, 2019, currentYear])(
    "aceita %i",
    (year) => {
      expect(isFormationYear(year)).toBe(true);
    },
  );

  test("aceita o ano corrente — banda formada este mês é caso real", () => {
    expect(isFormationYear(currentYear)).toBe(true);
  });

  test("🔴 recusa o ano que vem: não é imprecisão, é credencial falsa", () => {
    expect(isFormationYear(currentYear + 1)).toBe(false);
  });

  test("recusa antes de 1900", () => {
    expect(isFormationYear(FORMATION_YEAR_MIN - 1)).toBe(false);
    expect(isFormationYear(0)).toBe(false);
    expect(isFormationYear(-2019)).toBe(false);
  });

  test("recusa ano não inteiro — 2019.5 não é um ano", () => {
    expect(isFormationYear(2019.5)).toBe(false);
  });

  test.each([
    ["string numérica", "2019"],
    ["null", null],
    ["undefined", undefined],
    ["NaN", Number.NaN],
    ["Infinity", Number.POSITIVE_INFINITY],
    ["objeto", { year: 2019 }],
  ])(
    "recusa %s (o predicado é estrito; a ausência é tratada no decorator)",
    (_label, value) => {
      expect(isFormationYear(value)).toBe(false);
    },
  );

  /*
   * 🔴 O teto é recalculado a cada chamada, não capturado na carga do módulo.
   * Sem isso, um processo de pé desde dezembro recusaria o ano corrente depois
   * da virada. Falsear o relógio é o único jeito de provar a diferença.
   */
  test("o teto acompanha o relógio, não o load do módulo", () => {
    jest.useFakeTimers();
    try {
      // ⚠️ Datas montadas com `new Date(ano, mes, dia)` — hora LOCAL, de
      // propósito. Com `new Date("2032-01-01T00:00:00Z")` este teste falha em
      // qualquer fuso a oeste de Greenwich (o do projeto inclusive): meia-noite
      // UTC de 1º de janeiro ainda é 31 de dezembro em São Paulo, e
      // `getFullYear()` devolveria o ano anterior. O erro seria do fixture, não
      // do código — e mascararia o comportamento que o teste existe para provar.
      jest.setSystemTime(new Date(2031, 5, 15, 12));
      expect(isFormationYear(2031)).toBe(true);
      expect(isFormationYear(2032)).toBe(false);

      // A virada do ano: o mesmo valor que era futuro passa a ser válido.
      jest.setSystemTime(new Date(2032, 0, 1, 0, 0, 1));
      expect(isFormationYear(2032)).toBe(true);
    } finally {
      jest.useRealTimers();
    }
  });
});
