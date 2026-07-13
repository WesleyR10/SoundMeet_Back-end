import { plainToInstance } from "class-transformer";
import { validate } from "class-validator";

import { CustomizeQRCodeDto } from "../customize-qr-code.dto";

async function validateDto(payload: Record<string, unknown>) {
  const dto = plainToInstance(CustomizeQRCodeDto, payload);
  return validate(dto);
}

describe("CustomizeQRCodeDto", () => {
  it("aceita payload vazio (nenhum campo — no-op)", async () => {
    expect(await validateDto({})).toHaveLength(0);
  });

  it("aceita cores hex válidas", async () => {
    const errors = await validateDto({
      foreground_color: "#1a1a2e",
      background_color: "#fff",
    });
    expect(errors).toHaveLength(0);
  });

  it("rejeita cor que não é hex válido", async () => {
    const errors = await validateDto({ foreground_color: "not-a-color" });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("foreground_color");
  });

  it("aceita null em cores/label (reset ao padrão)", async () => {
    const errors = await validateDto({
      foreground_color: null,
      background_color: null,
      label: null,
    });
    expect(errors).toHaveLength(0);
  });

  it("aceita logo_url: null (remove o logo atual)", async () => {
    expect(await validateDto({ logo_url: null })).toHaveLength(0);
  });

  // Fixa o bug encontrado na auditoria: logo_url aceitava qualquer URL externa
  // via este endpoint, contornando a validação de tamanho/mimetype do upload
  // dedicado (POST /qr-code/logo). Só null (remover) é permitido aqui.
  it("rejeita logo_url com uma URL — só null é aceito", async () => {
    const errors = await validateDto({
      logo_url: "https://evil.example.com/tracker.png",
    });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("logo_url");
  });

  it("rejeita label acima de 80 caracteres", async () => {
    const errors = await validateDto({ label: "a".repeat(81) });
    expect(errors).toHaveLength(1);
    expect(errors[0].property).toBe("label");
  });
});
