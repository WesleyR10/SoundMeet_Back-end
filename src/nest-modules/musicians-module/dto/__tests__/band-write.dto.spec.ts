import { ArgumentMetadata, Type, ValidationPipe } from "@nestjs/common";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../../../global-config";
import { CreateBandDto } from "../create-band.dto";
import { InviteBandMemberDto } from "../invite-band-member.dto";
import { ListBandIdentitiesDto } from "../list-band-identities.dto";
import { SetBandOpenToGigsDto } from "../set-band-open-to-gigs.dto";
import { UpdateBandDto } from "../update-band.dto";

const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);

const parse = <T>(
  metatype: Type<T>,
  value: unknown,
  type: "body" | "query" = "body",
) => {
  const metadata: ArgumentMetadata = { type, metatype, data: "" };
  return pipe.transform(value, metadata) as Promise<T>;
};

const messagesOf = async <T>(
  metatype: Type<T>,
  value: unknown,
  type: "body" | "query" = "body",
): Promise<string[]> => {
  try {
    await parse(metatype, value, type);
    return [];
  } catch (error: any) {
    expect(error.getStatus()).toBe(422);
    return error.getResponse().message as string[];
  }
};

const MUSICIAN_ID = "03187da7-5db6-41d7-8ee7-1b11d0db463b";

describe("DTOs de escrita de banda — allowlist", () => {
  describe("CreateBandDto", () => {
    it("aceita o que o app manda", async () => {
      const dto = await parse(CreateBandDto, {
        name: "Blues Duo",
        description: "Duo de blues",
        genres: ["Blues"],
        open_to_gigs: true,
      });

      expect(dto).toMatchObject({ name: "Blues Duo", genres: ["Blues"] });
    });

    it.each([
      // Criava convites sem passar pelo gate de plano nem pelo aceite.
      ["members", [{ musician_id: MUSICIAN_ID, role: "leader" }]],
      // Quem lidera é quem está autenticado.
      ["creator_musician_id", MUSICIAN_ID],
      // `false` só existe como resultado de dissolver.
      ["is_active", false],
      // Não há upload de foto de banda; URL livre não entra.
      ["avatar", "https://evil.example/x.png"],
    ])("🔴 recusa `%s` no corpo", async (key, value) => {
      const messages = await messagesOf(CreateBandDto, {
        name: "Blues Duo",
        genres: ["Blues"],
        [key]: value,
      });

      expect(messages.join(" ")).toContain(key);
    });

    it("recusa nome vazio e gênero que não é texto", async () => {
      expect(
        await messagesOf(CreateBandDto, { name: "", genres: ["Blues"] }),
      ).not.toEqual([]);
      expect(
        await messagesOf(CreateBandDto, { name: "Blues Duo", genres: [1, 2] }),
      ).not.toEqual([]);
    });

    it("valida a faixa de preço e o endereço aninhados", async () => {
      expect(
        (
          await messagesOf(CreateBandDto, {
            name: "Blues Duo",
            genres: ["Blues"],
            priceRange: { model: "por_cabeça", min: 1, max: 2 },
          })
        ).join(" "),
      ).toContain("model");
      expect(
        (
          await messagesOf(CreateBandDto, {
            name: "Blues Duo",
            genres: ["Blues"],
            address: { city: "SP", zip_code: "123" },
          })
        ).join(" "),
      ).toContain("zip_code");
    });
  });

  describe("UpdateBandDto", () => {
    it("aceita `formed_in`, inclusive `null` para apagar", async () => {
      expect(await parse(UpdateBandDto, { formed_in: 2015 })).toMatchObject({
        formed_in: 2015,
      });
      expect(await parse(UpdateBandDto, { formed_in: null })).toMatchObject({
        formed_in: null,
      });
    });

    it.each([
      // Segunda porta para o consentimento — a rota dedicada existe.
      ["open_to_gigs", true],
      // Reativaria uma banda arquivada, ou a desativaria sem checar shows.
      ["is_active", false],
      ["avatar", "https://evil.example/x.png"],
      // O ator vem do token.
      ["requesting_musician_id", MUSICIAN_ID],
      ["is_admin", true],
      ["id", MUSICIAN_ID],
    ])("🔴 recusa `%s` no corpo", async (key, value) => {
      const messages = await messagesOf(UpdateBandDto, { [key]: value });

      expect(messages.join(" ")).toContain(key);
    });

    it("recusa nome vazio — antes era aceito e ignorado", async () => {
      expect(
        (await messagesOf(UpdateBandDto, { name: "" })).join(" "),
      ).toContain("name");
    });

    it("recusa ano de formação no futuro", async () => {
      expect(
        (
          await messagesOf(UpdateBandDto, {
            formed_in: new Date().getFullYear() + 1,
          })
        ).join(" "),
      ).toContain("formed_in");
    });
  });

  describe("InviteBandMemberDto", () => {
    it("aceita músico e instrumento", async () => {
      const dto = await parse(InviteBandMemberDto, {
        musician_id: MUSICIAN_ID,
        instrument: "Baixo",
      });

      expect(dto).toMatchObject({
        musician_id: MUSICIAN_ID,
        instrument: "Baixo",
      });
    });

    it("🔴 recusa `role`: convite é sempre para integrante", async () => {
      const messages = await messagesOf(InviteBandMemberDto, {
        musician_id: MUSICIAN_ID,
        instrument: "Baixo",
        role: "leader",
      });

      expect(messages.join(" ")).toContain("role");
    });

    it("recusa `musician_id` que não é UUID e o ator no corpo", async () => {
      expect(
        (
          await messagesOf(InviteBandMemberDto, {
            musician_id: "joão",
            instrument: "Baixo",
          })
        ).join(" "),
      ).toContain("musician_id");
      expect(
        (
          await messagesOf(InviteBandMemberDto, {
            musician_id: MUSICIAN_ID,
            instrument: "Baixo",
            is_admin: true,
          })
        ).join(" "),
      ).toContain("is_admin");
    });
  });

  describe("SetBandOpenToGigsDto", () => {
    it("aceita só o booleano", async () => {
      expect(
        await parse(SetBandOpenToGigsDto, { open_to_gigs: false }),
      ).toMatchObject({ open_to_gigs: false });
      expect(
        (
          await messagesOf(SetBandOpenToGigsDto, {
            open_to_gigs: true,
            requesting_musician_id: MUSICIAN_ID,
          })
        ).join(" "),
      ).toContain("requesting_musician_id");
    });
  });

  describe("ListBandIdentitiesDto", () => {
    it("lê a lista separada por vírgula", async () => {
      const dto = await parse(
        ListBandIdentitiesDto,
        { ids: `${MUSICIAN_ID}, 4f17dae8-b502-4db8-8155-45f6b1712d16` },
        "query",
      );

      expect(dto.ids).toEqual([
        MUSICIAN_ID,
        "4f17dae8-b502-4db8-8155-45f6b1712d16",
      ]);
    });

    it("recusa id que não é UUID e lista vazia", async () => {
      expect(
        await messagesOf(ListBandIdentitiesDto, { ids: "abc" }, "query"),
      ).not.toEqual([]);
      expect(
        await messagesOf(ListBandIdentitiesDto, { ids: "" }, "query"),
      ).not.toEqual([]);
    });
  });
});
