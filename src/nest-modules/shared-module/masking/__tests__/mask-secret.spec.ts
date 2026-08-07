import { maskBankAccount, maskSecretTail } from "../mask-secret";

describe("maskSecretTail (SM-016)", () => {
  it("mantém só os últimos 4 caracteres visíveis", () => {
    expect(maskSecretTail("52998224725")).toBe("*******4725");
  });

  it("mascara por completo quando o valor é menor ou igual ao número de caracteres visíveis", () => {
    expect(maskSecretTail("abcd")).toBe("****");
    expect(maskSecretTail("ab")).toBe("**");
  });

  it("retorna null para valores ausentes", () => {
    expect(maskSecretTail(null)).toBeNull();
    expect(maskSecretTail(undefined)).toBeNull();
    expect(maskSecretTail("")).toBeNull();
  });

  it("nunca inclui o valor original na saída", () => {
    const original = "musico@pix.com";
    expect(maskSecretTail(original)).not.toContain(original);
  });
});

describe("maskBankAccount (SM-016)", () => {
  it("retorna null para valores ausentes", () => {
    expect(maskBankAccount(null)).toBeNull();
    expect(maskBankAccount(undefined)).toBeNull();
  });

  it("mascara strings-folha de um objeto mantendo as chaves", () => {
    const result = maskBankAccount({
      bank: "001",
      agency: "1234",
      account: "987654321",
    });
    expect(result).toEqual({
      bank: maskSecretTail("001"),
      agency: maskSecretTail("1234"),
      account: maskSecretTail("987654321"),
    });
  });

  it("mascara arrays de strings recursivamente", () => {
    expect(maskBankAccount(["123456789"])).toEqual([
      maskSecretTail("123456789"),
    ]);
  });

  it("preserva valores não sensíveis (números/booleanos)", () => {
    expect(maskBankAccount({ verified: true, attempts: 3 })).toEqual({
      verified: true,
      attempts: 3,
    });
  });
});
