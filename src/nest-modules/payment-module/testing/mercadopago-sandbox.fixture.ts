/**
 * Insumos públicos de sandbox do Mercado Pago.
 *
 * Nada aqui é secret. Cartões e o CPF `12345678909` estão na documentação
 * oficial do MP (Checkout Transparente). Contas de teste (usuário/senha)
 * ficam só em `envs/.env` (gitignored) — não copiar para este arquivo.
 *
 * A gorjeta SoundMeet é PIX (`POST /v1/orders`). Estes cartões NÃO exercitam
 * esse caminho; existem para o E2E não nascer com número inventado no dia em
 * que alguém testar cartão, e para o status ir no NOME DO TITULAR — não no
 * CVV, não no número.
 */
export const MERCADOPAGO_SANDBOX_CARDS = [
  {
    brand: "mastercard",
    number: "5480832801033311",
    cvv: "123",
    expiration: "11/30",
  },
  {
    brand: "visa",
    number: "4235647728025682",
    cvv: "123",
    expiration: "11/30",
  },
  {
    brand: "amex",
    number: "375365153556885",
    cvv: "1234",
    expiration: "11/30",
  },
  {
    brand: "elo_debit",
    number: "5067766783888311",
    cvv: "123",
    expiration: "11/30",
  },
] as const;

/** Status de pagamento de teste — vai no nome do titular do cartão. */
export const MERCADOPAGO_SANDBOX_CARDHOLDER_STATUS = {
  APRO: "pagamento aprovado",
  OTHE: "recusado por erro geral",
  CONT: "pagamento pendente",
  CALL: "recusado com validação para autorizar",
  FUND: "recusado por quantia insuficiente",
  SECU: "recusado por código de segurança inválido",
  EXPI: "recusado por problema com a data de vencimento",
  FORM: "recusado por erro no formulário",
} as const;

export const MERCADOPAGO_SANDBOX_PAYER_CPF = "12345678909";

/** App canônica (homologada). A app 2780871563698928 é leftover. */
export const MERCADOPAGO_CANONICAL_APPLICATION_ID = "7348187308113120";

/**
 * Marketplace fee que o gateway deve mandar em R$20, com 0,99% do MP
 * descontado da alíquota anunciada. Três planos, três números — se a tabela
 * de preços mudar, este teste quebra de propósito.
 */
export const MERCADOPAGO_MARKETPLACE_FEE_ON_BRL_20 = {
  FREE: 1.6, // 9% − 0,99% = 8,01%
  ESSENTIAL: 1.2, // 7% − 0,99% = 6,01%
  PRO: 0.8, // 5% − 0,99% = 4,01%
} as const;
