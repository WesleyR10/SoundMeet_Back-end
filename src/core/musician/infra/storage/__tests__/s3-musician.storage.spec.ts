import { S3Client } from "@aws-sdk/client-s3";

import { S3MusicianStorage } from "../s3-musician.storage";

const uploadParams: Record<string, unknown>[] = [];

jest.mock("@aws-sdk/lib-storage", () => ({
  Upload: jest
    .fn()
    .mockImplementation((options: { params: Record<string, unknown> }) => {
      uploadParams.push(options.params);
      return { done: jest.fn().mockResolvedValue(undefined) };
    }),
}));

describe("S3MusicianStorage", () => {
  beforeEach(() => {
    uploadParams.length = 0;
  });

  const make = (publicBaseUrl: string | null = "https://cdn.test") =>
    new S3MusicianStorage(
      { send: jest.fn().mockResolvedValue(undefined) } as unknown as S3Client,
      "bucket-de-teste",
      publicBaseUrl,
    );

  /*
   * Toda chave gravada por aqui leva um uuid novo: o conteúdo de uma URL nunca
   * muda. Sem `Cache-Control`, navegador e CDN revalidavam a mesma foto a cada
   * exibição da grade de artistas.
   */
  it("sobe o objeto com cache de um ano, imutável", async () => {
    await make().putObject({
      object_key: "musicians/x/avatar/a.jpg",
      data: Buffer.from("x"),
      content_type: "image/jpeg",
    });

    expect(uploadParams).toEqual([
      {
        Bucket: "bucket-de-teste",
        Key: "musicians/x/avatar/a.jpg",
        Body: expect.any(Buffer),
        ContentType: "image/jpeg",
        CacheControl: "public, max-age=31536000, immutable",
      },
    ]);
  });

  it("monta a URL pública sem barra dobrada e preservando as barras da chave", () => {
    expect(make("https://cdn.test/").getPublicUrl("musicians/x/a b.jpg")).toBe(
      "https://cdn.test/musicians/x/a%20b.jpg",
    );
  });

  it("sem base pública, não inventa URL", () => {
    expect(make(null).getPublicUrl("musicians/x/a.jpg")).toBeNull();
  });
});
