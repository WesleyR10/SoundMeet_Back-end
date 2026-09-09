import { UnprocessableEntityException } from "@nestjs/common";

/*
 * `file-type` é ESM-only e o loader do Jest não faz a interop de `require(esm)`
 * que o Node faz em produção (o dist compilado usa esse caminho com sucesso —
 * só o test runner não). Mesmo tratamento de `safe-url-fetcher.spec.ts`.
 *
 * ⚠️ **Consequência honesta:** com o detector mockado, este arquivo prova a
 * LÓGICA (janela de leitura, null, política de allowlist, 422) e **não** prova o
 * VOCABULÁRIO — que o `file-type` devolve `audio/flac` e não `audio/x-flac` para
 * um FLAC de verdade. Esse acoplamento é o que quebraria a pipeline de IA numa
 * major do pacote, e quem o exercita com módulos reais é o e2e
 * (`test/ai-cifra/ai-cifra.analysis.e2e-spec.ts`), que sobe a app de verdade.
 */
jest.mock("file-type", () => ({ fileTypeFromBuffer: jest.fn() }), {
  virtual: true,
});

import { fileTypeFromBuffer } from "file-type";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";

import { assertFileSignature, detectFileMime } from "../detect-file-mime";

const mockedDetect = fileTypeFromBuffer as unknown as jest.Mock;

describe("detectFileMime / assertFileSignature (UPL-1)", () => {
  let dir: string;

  beforeAll(async () => {
    dir = await mkdtemp(join(tmpdir(), "sm-magic-"));
  });

  afterAll(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  beforeEach(() => {
    mockedDetect.mockReset();
  });

  async function fixture(name: string, bytes: Buffer | string) {
    const path = join(dir, name);
    await writeFile(path, bytes);
    return path;
  }

  it("devolve o MIME que o detector identificou nos bytes", async () => {
    mockedDetect.mockResolvedValue({ mime: "audio/mpeg", ext: "mp3" });
    const path = await fixture("a.bin", Buffer.from("ID3"));

    await expect(detectFileMime(path)).resolves.toBe("audio/mpeg");
  });

  it("devolve null quando os bytes não identificam formato conhecido", async () => {
    mockedDetect.mockResolvedValue(undefined);
    const path = await fixture("texto.txt", "texto puro, sem magic number");

    await expect(detectFileMime(path)).resolves.toBeNull();
  });

  it("não passa preenchimento de zeros ao detector em arquivo curto", async () => {
    // `Buffer.alloc(4100)` sem `subarray` entregaria 4092 bytes de zeros depois
    // do cabeçalho — zero é conteúdo, e alguns detectores o interpretam.
    // Arquivo curto é o caso normal de um ícone ou de um sample.
    mockedDetect.mockResolvedValue({ mime: "image/png", ext: "png" });
    const header = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
    const path = await fixture("curto.png", header);

    await detectFileMime(path);

    expect(mockedDetect).toHaveBeenCalledTimes(1);
    expect(mockedDetect.mock.calls[0][0]).toHaveLength(header.length);
  });

  it("lê no máximo a janela de assinatura de um arquivo grande", async () => {
    mockedDetect.mockResolvedValue({ mime: "audio/wav", ext: "wav" });
    const path = await fixture("grande.bin", Buffer.alloc(20000, 65));

    await detectFileMime(path);

    expect(mockedDetect.mock.calls[0][0]).toHaveLength(4100);
  });

  it("devolve o MIME detectado quando está na allowlist", async () => {
    mockedDetect.mockResolvedValue({ mime: "image/png", ext: "png" });
    const path = await fixture("ok.png", Buffer.from("x"));

    await expect(
      assertFileSignature(path, ["image/jpeg", "image/png"], "nope"),
    ).resolves.toBe("image/png");
  });

  it("recusa executável disfarçado de áudio — o cenário do UPL-1", async () => {
    // O cliente manda `Content-Type: audio/mpeg`; os bytes dizem `MZ`.
    mockedDetect.mockResolvedValue({
      mime: "application/x-msdownload",
      ext: "exe",
    });
    const path = await fixture("malware.mp3", Buffer.from("MZ"));

    await expect(
      assertFileSignature(path, ["audio/mpeg"], "só áudio"),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("recusa formato válido porém fora da allowlist", async () => {
    // PDF é arquivo legítimo — só não num upload de áudio.
    mockedDetect.mockResolvedValue({ mime: "application/pdf", ext: "pdf" });
    const path = await fixture("doc.pdf", Buffer.from("%PDF-1.7"));

    await expect(
      assertFileSignature(path, ["audio/mpeg"], "só áudio"),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });

  it("recusa arquivo indetectável em vez de deixar passar", async () => {
    // Fail-closed: não identificar não é motivo para aceitar.
    mockedDetect.mockResolvedValue(undefined);
    const path = await fixture("vazio.bin", Buffer.alloc(0));

    await expect(
      assertFileSignature(path, ["audio/mpeg"], "só áudio"),
    ).rejects.toBeInstanceOf(UnprocessableEntityException);
  });
});
