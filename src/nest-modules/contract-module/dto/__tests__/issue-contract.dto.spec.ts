import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../../../global-config";
import { IssueContractDto } from "../contract.dto";

/**
 * A retentativa de emissão na FRONTEIRA HTTP.
 *
 * Dois defeitos reais moram aqui, e nenhum aparece num teste que monta o input
 * em memória — a lição registrada no 9.7 ("todo teste do backend pula a
 * fronteira, que é exatamente onde os bugs moram"):
 *
 * 1. **`requesting_participant_ids` vindo do corpo.** O controller faz spread
 *    de `...dto` antes de sobrescrever com os claims do JWT. Se o campo
 *    sobrevivesse ao pipe, a ordem das chaves passaria a ser a única coisa
 *    entre um cliente e a autorização — e ordem de chave não é mecanismo de
 *    segurança.
 * 2. **`exclusivity_requested` e `tone` vindos do corpo.** Exclusividade tem
 *    tetos legais e é opt-in por desenho; o tom escolhe a redação que a OUTRA
 *    parte vai assinar. A decisão de produto da fatia B3 é que a retentativa
 *    carrega só o `booking_id` — e é este arquivo que a torna verdade em vez
 *    de convenção.
 *
 * O pipe é o de `applyGlobalConfig` (`GLOBAL_VALIDATION_PIPE_OPTIONS`), não uma
 * cópia das opções. Divergir tornaria o teste decorativo — foi o que aconteceu
 * quando o INP-1 ligou `forbidNonWhitelisted` na produção e esta spec continuou
 * afirmando o descarte silencioso.
 *
 * ⚠️ **O que MUDOU com o INP-1:** os campos abaixo saíam do corpo em silêncio e
 * a request seguia 200. Hoje viram 422. A garantia é a mesma — nenhum deles
 * alcança o handler —, mas a tentativa passou a ser observável. O
 * `contract.api.ts` do web manda só `booking_id`, então cliente legítimo não é
 * afetado.
 */
// O pipe de produção, não uma cópia das opções — ver o comentário em
// `GLOBAL_VALIDATION_PIPE_OPTIONS`.
const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);

const META: ArgumentMetadata = {
  type: "body",
  metatype: IssueContractDto,
  data: "",
};

const BOOKING_ID = "11111111-1111-4111-8111-111111111111";

describe("IssueContractDto (fronteira HTTP)", () => {
  it("aceita o corpo mínimo — só o booking_id", async () => {
    const result = await pipe.transform({ booking_id: BOOKING_ID }, META);

    expect(result).toEqual({ booking_id: BOOKING_ID });
  });

  it.each([
    [
      "identidade do requisitante",
      "requesting_participant_ids",
      ["99999999-9999-4999-8999-999999999999"],
    ],
    ["privilégio", "is_admin", true],
    ["tom da redação", "tone", "rigoroso"],
    ["exclusividade", "exclusivity_requested", true],
    ["área descoberta", "outdoor", true],
  ])(
    "recusa %s vindo do corpo, com 422 (INP-1)",
    async (_rotulo, campo, valor) => {
      await expect(
        pipe.transform({ booking_id: BOOKING_ID, [campo]: valor }, META),
      ).rejects.toMatchObject({ status: 422 });
    },
  );

  it("campo declarado sem inicializador NÃO vira propriedade da instância", () => {
    // Guarda de compilador — ver a nota gêmea em
    // `propose-booking-proposed-by.dto.spec.ts`. `IssueContractInput` declara
    // `requesting_participant_ids` e `is_admin` sem decorator; se o compilador
    // os materializar, o corpo mínimo legítimo passa a levar 422.
    expect(Object.getOwnPropertyNames(new IssueContractDto())).toEqual([]);
  });

  it("recusa booking_id ausente ou fora do formato", async () => {
    await expect(pipe.transform({}, META)).rejects.toThrow();
    await expect(
      pipe.transform({ booking_id: "nao-e-uuid" }, META),
    ).rejects.toThrow();
  });
});
