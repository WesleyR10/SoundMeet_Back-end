import { ArgumentMetadata, ValidationPipe } from "@nestjs/common";

import { GLOBAL_VALIDATION_PIPE_OPTIONS } from "../../../global-config";
import { ListMusicianIdentitiesDto } from "../list-musician-identities.dto";

const pipe = new ValidationPipe(GLOBAL_VALIDATION_PIPE_OPTIONS);
const metadata: ArgumentMetadata = {
  type: "query",
  metatype: ListMusicianIdentitiesDto,
  data: "",
};

const parse = (query: Record<string, unknown>) =>
  pipe.transform(query, metadata) as Promise<ListMusicianIdentitiesDto>;

const A = "9366b7dc-2d71-4799-b91c-c64adb205104";
const B = "49fd851f-be83-4bc7-9776-2f2d037499ef";

describe("ListMusicianIdentitiesDto", () => {
  it("aceita ids separados por vírgula", async () => {
    await expect(parse({ ids: `${A},${B}` })).resolves.toMatchObject({
      ids: [A, B],
    });
  });

  it("tolera espaço e vírgula sobrando", async () => {
    await expect(parse({ ids: ` ${A} , ${B}, ` })).resolves.toMatchObject({
      ids: [A, B],
    });
  });

  it("aceita a forma de lista (ids[]=…)", async () => {
    await expect(parse({ ids: [A, B] })).resolves.toMatchObject({
      ids: [A, B],
    });
  });

  it.each([
    ["ausente", {}],
    ["vazio", { ids: "" }],
    ["só vírgulas", { ids: ",," }],
    ["id que não é UUID", { ids: `${A},nao-e-uuid` }],
    ["objeto (o qs acima de 20 itens)", { ids: { 0: A, 1: B } }],
  ])("recusa %s com 422", async (_label, query) => {
    await expect(parse(query)).rejects.toMatchObject({ status: 422 });
  });

  it("recusa mais de 50 ids", async () => {
    const ids = Array.from(
      { length: 51 },
      (_, index) =>
        `9366b7dc-2d71-4799-b91c-${String(index).padStart(12, "0")}`,
    ).join(",");

    await expect(parse({ ids })).rejects.toMatchObject({ status: 422 });
  });

  it("recusa parâmetro desconhecido ao lado", async () => {
    await expect(parse({ ids: A, expand: "profile" })).rejects.toMatchObject({
      status: 422,
    });
  });
});
