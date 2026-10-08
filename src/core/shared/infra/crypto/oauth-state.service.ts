import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export type OAuthStatePayload = {
  musician_id: string;
  nonce: string;
  exp: number;
  purpose: string;
};

const DEFAULT_TTL_MS = 10 * 60 * 1000;

export class InvalidOAuthStateError extends Error {
  constructor(message = "state do OAuth inválido, expirado ou adulterado") {
    super(message);
    this.name = "InvalidOAuthStateError";
  }
}

/**
 * Assina e verifica o parâmetro `state` de um fluxo OAuth (defesa CSRF).
 *
 * HMAC-SHA256 sobre `{musician_id, nonce, exp, purpose}` em base64url.
 *
 * ## Por que a autenticidade depende inteiramente disto
 *
 * O callback chega pelo NAVEGADOR, redirecionado pelo provedor — **sem Bearer
 * token**. Não há `@CurrentUser()` para consultar. O `musician_id` que diz de
 * quem é a conta a vincular vem do `state`, e só a assinatura impede que alguém
 * monte um `state` apontando para outra pessoa e vincule a própria conta de
 * pagamento ao músico dela.
 *
 * ## Por que `purpose`
 *
 * Dois fluxos OAuth diferentes (Google Calendar e Mercado Pago) assinam com o
 * mesmo segredo. Sem o `purpose`, um `state` emitido para conectar o calendário
 * seria aceito no callback do gateway de pagamento — e vincularia uma conta que
 * recebe dinheiro num fluxo que o usuário achou que era de agenda. A verificação
 * exige o propósito esperado, então um não serve para o outro.
 *
 * Genérico de propósito: é o mesmo mecanismo para qualquer provedor, e duas
 * implementações da mesma verificação de assinatura divergiriam na primeira
 * correção que só uma recebesse.
 */
export class OAuthStateService {
  constructor(
    private readonly secret: string,
    private readonly purpose: string,
    private readonly ttlMs: number = DEFAULT_TTL_MS,
  ) {
    if (!secret?.trim()) {
      throw new Error("OAuthStateService requer secret não-vazio");
    }
    if (!purpose?.trim()) {
      throw new Error("OAuthStateService requer purpose não-vazio");
    }
  }

  sign(musician_id: string): string {
    const payload: OAuthStatePayload = {
      musician_id,
      nonce: randomBytes(16).toString("hex"),
      exp: Date.now() + this.ttlMs,
      purpose: this.purpose,
    };
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
      "base64url",
    );
    return `${encoded}.${this.hmac(encoded)}`;
  }

  /** Devolve o `musician_id` embutido; lança `InvalidOAuthStateError` se inválido. */
  verify(state: string): { musician_id: string } {
    const [encoded, signature] = (state ?? "").split(".");
    if (!encoded || !signature) {
      throw new InvalidOAuthStateError();
    }

    /*
     * Assinatura ANTES do parse: verificar o conteúdo de um payload não
     * confiável é dar ao atacante um interpretador. E `timingSafeEqual` porque
     * comparar HMAC com `===` vaza o prefixo correto pelo tempo de resposta.
     */
    const expected = Buffer.from(this.hmac(encoded), "utf8");
    const received = Buffer.from(signature, "utf8");
    if (
      expected.length !== received.length ||
      !timingSafeEqual(expected, received)
    ) {
      throw new InvalidOAuthStateError();
    }

    let payload: OAuthStatePayload;
    try {
      payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8"));
    } catch {
      throw new InvalidOAuthStateError();
    }

    if (
      payload.purpose !== this.purpose ||
      typeof payload.musician_id !== "string" ||
      typeof payload.exp !== "number" ||
      payload.exp < Date.now()
    ) {
      throw new InvalidOAuthStateError();
    }

    return { musician_id: payload.musician_id };
  }

  private hmac(encoded: string): string {
    return createHmac("sha256", this.secret)
      .update(encoded)
      .digest("base64url");
  }
}
