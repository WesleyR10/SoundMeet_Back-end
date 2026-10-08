import { ValidationPipe } from "@nestjs/common";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../../../global-config";
import { ConvertInquiryToBookingDto } from "../convert-inquiry-to-booking.dto";
import { ProposeBookingDto } from "../propose-booking.dto";
import { ReviseBookingProposalDto } from "../revise-booking-proposal.dto";

/**
 * Proposta é OFERTA: data e cachê (decisão de produto de 25/set/2026).
 * Conversar sem valor é a inquiry — por isso as TRÊS portas que produzem uma
 * proposta (propor, converter inquiry, revisar) exigem `fee` já no pipe.
 *
 * O domínio (`Booking.assertProposalTerms`) é a barreira final; este spec
 * trava a borda HTTP, para o 422 nomear o campo em vez de a regra depender
 * de alguém lembrar do agregado. Pipe REAL, não cópia das opções.
 */
const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);

const TERMS = {
  start_at: "2026-10-10T22:00:00.000Z",
  end_at: "2026-10-11T02:00:00.000Z",
};

const PORTAS = [
  {
    nome: "ProposeBookingDto",
    metatype: ProposeBookingDto,
    corpo: {
      establishment_id: "33333333-3333-4333-8333-333333333333",
      musician_id: "11111111-1111-4111-8111-111111111111",
      ...TERMS,
    },
  },
  {
    nome: "ConvertInquiryToBookingDto",
    metatype: ConvertInquiryToBookingDto,
    corpo: { ...TERMS },
  },
  {
    nome: "ReviseBookingProposalDto",
    metatype: ReviseBookingProposalDto,
    corpo: { ...TERMS },
  },
] as const;

async function motivos(
  metatype: (typeof PORTAS)[number]["metatype"],
  corpo: Record<string, unknown>,
): Promise<string> {
  try {
    await pipe.transform(corpo, { type: "body", metatype });
  } catch (error) {
    return JSON.stringify((error as { getResponse(): unknown }).getResponse());
  }
  throw new Error("o pipe aceitou o corpo");
}

describe.each(PORTAS)("$nome — cachê obrigatório", ({ metatype, corpo }) => {
  it("recusa proposta SEM cachê, nomeando o campo", async () => {
    await expect(motivos(metatype, corpo)).resolves.toContain("fee");
  });

  it.each([null, 0, -100])("recusa cachê %p", async (fee) => {
    await expect(motivos(metatype, { ...corpo, fee })).resolves.toContain(
      "fee",
    );
  });

  it("aceita proposta com data e cachê", async () => {
    await expect(
      pipe.transform({ ...corpo, fee: 800 }, { type: "body", metatype }),
    ).resolves.toMatchObject({ fee: 800 });
  });
});
