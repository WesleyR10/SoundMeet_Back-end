import { ValidationPipe } from "@nestjs/common";
import { plainToInstance } from "class-transformer";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../../../global-config";
import { ProposeBookingDto } from "../propose-booking.dto";

/**
 * `proposed_by` é campo de AUTORIA — nunca pode vir do cliente.
 *
 * Se um estabelecimento conseguisse enviar `proposed_by: "musician"` no corpo,
 * o próprio mecanismo criado para expor a autoconfirmação passaria a
 * escondê-la: o painel mostraria "o artista propôs, confirme" para uma proposta
 * que o estabelecimento fez sozinho. É a mesma classe de problema que o Bloco 9
 * corrigiu no autor de avaliação, forjável pelo corpo.
 *
 * A barreira aqui não é um `if` — é a AUSÊNCIA de decorator de validação em
 * `ProposeBookingInput.proposed_by`. O ValidationPipe global nunca deixa uma
 * propriedade sem decorator chegar ao handler. Este teste exercita o pipe REAL
 * (`GLOBAL_VALIDATION_PIPE_OPTIONS`, o mesmo objeto que `applyGlobalConfig`
 * usa), porque testar o DTO isolado não provaria nada sobre o que chega ao
 * handler.
 *
 * ⚠️ **O que MUDOU com o INP-1:** antes, `whitelist: true` sozinho removia o
 * campo em silêncio e a request seguia 200. Com `forbidNonWhitelisted` a
 * tentativa vira 422. A garantia de segurança é a mesma nos dois casos — o
 * valor nunca chega ao handler —, mas agora a tentativa aparece no log em vez
 * de sumir. Cliente legítimo nunca manda `proposed_by`: quem escreve o campo é
 * o controller, a partir dos papéis do JWT.
 */

const START_ISO = "2026-09-10T22:00:00.000Z";
const END_ISO = "2026-09-11T02:00:00.000Z";
const ESTABELECIMENTO_ID = "33333333-3333-4333-8333-333333333333";
const MUSICO_ID = "11111111-1111-4111-8111-111111111111";

/** Mesma configuração do ValidationPipe global. */
// O pipe de produção, não uma cópia das opções — ver o comentário em
// `GLOBAL_VALIDATION_PIPE_OPTIONS`.
const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);

const metadata = {
  type: "body" as const,
  metatype: ProposeBookingDto,
};

function corpoValido(extra: Record<string, unknown> = {}) {
  return {
    establishment_id: ESTABELECIMENTO_ID,
    musician_id: MUSICO_ID,
    start_at: START_ISO,
    end_at: END_ISO,
    ...extra,
  };
}

describe("ProposeBookingDto — proposed_by não é aceito do cliente", () => {
  it("recusa `proposed_by` enviado no corpo, com 422 (INP-1)", async () => {
    await expect(
      pipe.transform(corpoValido({ proposed_by: "musician" }), metadata),
    ).rejects.toMatchObject({ status: 422 });
  });

  /*
   * 🔴 Esta é a metade que quase passou despercebida: com `forbidNonWhitelisted`,
   * um corpo LEGÍTIMO passa a depender de o compilador não materializar
   * `proposed_by` como propriedade própria da instância. O tsc (produção) não
   * materializa; o SWC (jest) materializava, até o `.swcrc` ganhar
   * `useDefineForClassFields: false` para casar com o `tsconfig.json`. Sem esse
   * alinhamento este teste falha — e falharia em produção no dia em que alguém
   * tirasse o `--builder tsc` do script de build.
   */
  it("continua aceitando um corpo válido sem o campo", async () => {
    const resultado = (await pipe.transform(corpoValido(), metadata)) as Record<
      string,
      unknown
    >;

    expect(resultado.establishment_id).toBe(ESTABELECIMENTO_ID);
    expect(resultado.start_at).toBeInstanceOf(Date);
  });

  it("campo declarado sem inicializador NÃO vira propriedade da instância", () => {
    // Guarda de compilador: se o `.swcrc` divergir do `tsconfig.json` de novo,
    // este array deixa de ser vazio e todo corpo legítimo passa a levar 422.
    expect(Object.getOwnPropertyNames(new ProposeBookingDto())).toEqual([]);
  });

  it("o campo existe na classe, para o controller poder escrevê-lo", () => {
    // Guarda contra a "limpeza" oposta: remover a propriedade da classe
    // quebraria a atribuição do controller sem falhar nenhum outro teste.
    const instancia = plainToInstance(ProposeBookingDto, corpoValido());
    instancia.proposed_by = "establishment";

    expect(instancia.proposed_by).toBe("establishment");
  });
});
