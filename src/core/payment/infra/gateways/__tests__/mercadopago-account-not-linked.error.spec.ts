import { DomainError } from "../../../../shared/domain/errors/domain.error";
import { InvalidOperationError } from "../../../../shared/domain/errors/invalid-operation.error";
import { MercadoPagoAccountNotLinkedError } from "../mercadopago-account.resolver";

/**
 * O tipo do erro de "artista sem conta vinculada".
 *
 * ## Por que isto merece teste próprio
 *
 * Até 08/set/2026 a classe era `extends Error` puro. O `GlobalExceptionFilter`
 * mapeia por `instanceof` (`EntityValidationError`, `NotFoundError`,
 * `InvalidOperationError`, `ConflictError`…) e não reconhecia esta — então ela
 * caía no ramo genérico e virava **500 `unexpected error`**.
 *
 * O custo era invisível de dois jeitos ao mesmo tempo:
 *
 *  - o fã recebia um 500 sem a mensagem acionável, e o app o tratava como
 *    "tente de novo" numa gorjeta que **nunca** ia passar — exatamente o que o
 *    comentário da própria classe dizia estar evitando;
 *  - o monitoramento registrava uma regra de negócio previsível como defeito de
 *    servidor, o que envenena qualquer alarme baseado em taxa de 5xx.
 *
 * Nenhum teste unitário do repositório atravessa a fronteira HTTP, então o
 * mapeamento do filtro não era exercido por ninguém — o defeito só apareceu
 * rodando o Cypress contra o backend real. Este teste é a rede que faltava:
 * ele não sobe HTTP, mas trava a **condição** de que o filtro depende.
 */
describe("MercadoPagoAccountNotLinkedError", () => {
  const error = new MercadoPagoAccountNotLinkedError("musician-123");

  /*
   * 🔴 A asserção que importa. Se alguém trocar a superclasse por `Error`
   * "para simplificar", o `instanceof InvalidOperationError` do
   * `GlobalExceptionFilter` deixa de casar e a resposta volta a ser 500 — sem
   * nenhum outro teste quebrando.
   */
  it("é um InvalidOperationError, que o filtro global mapeia para 422", () => {
    expect(error).toBeInstanceOf(InvalidOperationError);
    expect(error).toBeInstanceOf(DomainError);
  });

  it("preserva o nome, que é o que aparece no log", () => {
    expect(error.name).toBe("MercadoPagoAccountNotLinkedError");
  });

  it("carrega uma mensagem pronta para o usuário, não um código interno", () => {
    // O corpo do 422 devolve `message` direto; se ela virar jargão, o fã lê
    // jargão.
    expect(error.message).toBe(
      "Este artista ainda não conectou uma conta para receber gorjetas.",
    );
  });

  it("expõe o musician_id para quem vai oferecer o caminho de correção", () => {
    expect(error.musician_id).toBe("musician-123");
    expect(error.metadata).toMatchObject({ musician_id: "musician-123" });
  });
});
