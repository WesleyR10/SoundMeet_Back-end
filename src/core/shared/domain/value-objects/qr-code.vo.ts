import { InvalidArgumentError } from "../errors/invalid-argument.error";
import { ValueObject } from "../value-object";

export type QRCustomization = {
  foreground_color?: string;
  background_color?: string;
  logo_url?: string;
  label?: string;
};

// Semântica de JSON merge patch (RFC 7396) para customizeQRCode(): valor
// presente = define; `null` = remove a chave (volta ao padrão); ausente
// (undefined) = mantém o que já existia. Sem isso não haveria forma de um
// músico reverter uma cor customizada sem apagar o resto (logo/label juntos).
export type QRCustomizationPatch = {
  foreground_color?: string | null;
  background_color?: string | null;
  logo_url?: string | null;
  label?: string | null;
};

const HEX_COLOR_PATTERN = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;

function hexToRgb(hex: string): [number, number, number] {
  let normalized = hex.replace("#", "");
  if (normalized.length === 3) {
    normalized = normalized
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const value = parseInt(normalized, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

function relativeLuminance([r, g, b]: [number, number, number]): number {
  const channel = (c: number) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  };
  return (
    0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
  );
}

// Fórmula de contraste do WCAG 2.x — reaproveitada aqui não para acessibilidade
// de texto, mas como proxy barato pra "esse par de cores dá um QR legível pra
// câmera". 2:1 é bem mais permissivo que os 4.5:1 exigidos pra texto (AA);
// serve só pra barrar combinações que resultariam num QR praticamente invisível
// (ex.: mesma cor, ou tons quase idênticos).
const MIN_QR_CONTRAST_RATIO = 2;

export function getQrContrastRatio(hexA: string, hexB: string): number {
  const luminanceA = relativeLuminance(hexToRgb(hexA));
  const luminanceB = relativeLuminance(hexToRgb(hexB));
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

export function hasSufficientQrContrast(
  foreground: string,
  background: string,
): boolean {
  if (
    !HEX_COLOR_PATTERN.test(foreground) ||
    !HEX_COLOR_PATTERN.test(background)
  ) {
    // Formato inválido já é barrado pelo @IsHexColor() do DTO — aqui só
    // avaliamos contraste de valores que já são hex válidos.
    return true;
  }
  return getQrContrastRatio(foreground, background) >= MIN_QR_CONTRAST_RATIO;
}

export class QRCode extends ValueObject {
  readonly code: string;
  readonly url: string;
  readonly expiresAt?: Date;
  readonly customization?: QRCustomization;

  constructor({
    code,
    url,
    expiresAt,
    customization,
  }: {
    code: string;
    url: string;
    expiresAt?: Date;
    customization?: QRCustomization;
  }) {
    super();
    this.code = code;
    this.url = url;
    this.expiresAt = expiresAt;
    this.customization = customization;
    this.validate();
  }

  private validate(): void {
    if (!this.code || this.code.trim().length === 0) {
      throw new InvalidArgumentError("QR Code cannot be empty");
    }

    if (!this.url || this.url.trim().length === 0) {
      throw new InvalidArgumentError("QR Code URL cannot be empty");
    }

    // Validar formato de URL
    try {
      new URL(this.url);
    } catch {
      throw new InvalidArgumentError("QR Code URL must be a valid URL");
    }

    if (this.expiresAt && this.expiresAt <= new Date()) {
      throw new InvalidArgumentError(
        "QR Code expiration date must be in the future",
      );
    }

    if (
      this.customization?.foreground_color &&
      this.customization?.background_color &&
      !hasSufficientQrContrast(
        this.customization.foreground_color,
        this.customization.background_color,
      )
    ) {
      throw new InvalidArgumentError(
        "As cores escolhidas têm contraste insuficiente e podem tornar o QR Code ilegível para leitura por câmera. Escolha cores mais contrastantes.",
      );
    }
  }

  get isExpired(): boolean {
    if (!this.expiresAt) {
      return false;
    }
    return this.expiresAt <= new Date();
  }

  get isValid(): boolean {
    return !this.isExpired;
  }

  get formatted(): string {
    const maybeBtoa = (globalThis as any).btoa;
    if (typeof maybeBtoa === "function") {
      return maybeBtoa(this.code);
    }
    return Buffer.from(this.code, "utf8").toString("base64");
  }

  toJSON() {
    return {
      code: this.code,
      url: this.url,
      formatted: this.formatted,
      expiresAt: this.expiresAt,
      isExpired: this.isExpired,
      isValid: this.isValid,
      customization: this.customization ?? null,
    };
  }
}
