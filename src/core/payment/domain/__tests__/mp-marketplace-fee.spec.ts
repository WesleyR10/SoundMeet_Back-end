import { splitAmountInCents } from "../split-amount";

/**
 * MP.5 — a tabela de preços promete "9%/7%/5% (1% gateway incluso)".
 * Os números têm que viver no domínio: se alguém "simplificar" para
 * `amount * 0.09`, o teste do use case ainda passaria com o mock errado.
 */
describe("MP.5 marketplace_fee em R$20 (gateway 0,99% incluso)", () => {
  it.each([
    ["FREE", 9, 1.6],
    ["ESSENTIAL", 7, 1.2],
    ["PRO", 5, 0.8],
  ] as const)(
    "%s (%s%% anunciados) → marketplace_fee R$%s",
    (_tier, planPct, expected) => {
      const net = Math.max(planPct - 0.99, 0);
      expect(splitAmountInCents(20, net).platform_fee.amount).toBe(expected);
    },
  );
});
