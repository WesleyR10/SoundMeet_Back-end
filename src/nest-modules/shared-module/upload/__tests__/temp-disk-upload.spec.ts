import { tmpdir } from "os";

import { tempDiskUpload } from "../temp-disk-upload";

type StorageWithHandlers = {
  getDestination: (
    req: unknown,
    file: unknown,
    cb: (error: Error | null, destination: string) => void,
  ) => void;
  getFilename: (
    req: unknown,
    file: { originalname?: string },
    cb: (error: Error | null, filename: string) => void,
  ) => void;
};

const filenameFor = (
  originalname: string | undefined,
  fallbackName = "arquivo",
) => {
  const options = tempDiskUpload({ fallbackName, maxFileSize: 1024 });
  const storage = options.storage as unknown as StorageWithHandlers;
  let result = "";
  storage.getFilename({}, { originalname }, (_error, filename) => {
    result = filename;
  });
  return result;
};

describe("tempDiskUpload", () => {
  it("grava no diretório temporário do sistema", () => {
    const storage = tempDiskUpload({ fallbackName: "x", maxFileSize: 1 })
      .storage as unknown as StorageWithHandlers;
    let destination = "";
    storage.getDestination({}, {}, (_error, value) => {
      destination = value;
    });

    expect(destination).toBe(tmpdir());
  });

  it("aplica o teto de tamanho informado", () => {
    expect(
      tempDiskUpload({ fallbackName: "x", maxFileSize: 5 * 1024 * 1024 })
        .limits,
    ).toEqual({ fileSize: 5 * 1024 * 1024 });
  });

  /*
   * O `originalname` é do cliente. Barra, `..` e caractere de controle não
   * podem chegar ao nome do arquivo em disco.
   */
  it.each([
    ["../../etc/passwd", ".._.._etc_passwd"],
    ["foto do show.jpg", "foto_do_show.jpg"],
    ["a\u0000b.png", "a_b.png"],
    ["C:\\Users\\x\\foto.png", "C__Users_x_foto.png"],
  ])("saneia o nome %p", (originalname, expectedSuffix) => {
    const filename = filenameFor(originalname);

    expect(filename.endsWith(`-${expectedSuffix}`)).toBe(true);
    expect(filename).not.toMatch(/[\/\\\u0000]/);
  });

  it("usa o nome de fallback quando o cliente não manda nome", () => {
    expect(filenameFor(undefined, "avatar").endsWith("-avatar")).toBe(true);
    expect(filenameFor("", "avatar").endsWith("-avatar")).toBe(true);
  });

  it("dois envios do mesmo arquivo nunca colidem", () => {
    expect(filenameFor("foto.jpg")).not.toBe(filenameFor("foto.jpg"));
  });

  it("não tem fileFilter: o formato é decidido pelos bytes, no handler", () => {
    expect(
      tempDiskUpload({ fallbackName: "x", maxFileSize: 1 }),
    ).not.toHaveProperty("fileFilter");
  });
});
