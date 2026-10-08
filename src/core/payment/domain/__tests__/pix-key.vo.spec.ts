import { InvalidArgumentError } from "../../../shared/domain/errors/invalid-argument.error";
import { PixKey, PixKeyType } from "../value-objects/pix-key.vo";

describe("PixKey VO", () => {
  describe("tipo inválido (A2 — o bypass que foi fechado)", () => {
    it("recusa um tipo fora do enum em vez de aceitar sem validar", () => {
      // Antes da correção, um `type` desconhecido não caía em nenhum `case` do
      // switch e a chave passava sem NENHUMA validação de formato.
      expect(() => new PixKey("qualquer-coisa", "banana")).toThrow(
        InvalidArgumentError,
      );
    });

    it("recusa tipo vazio", () => {
      expect(() => new PixKey("12345678909", "")).toThrow(InvalidArgumentError);
    });
  });

  describe("isValidType", () => {
    it.each(["cpf", "cnpj", "email", "phone", "random"])(
      "aceita %s",
      (type) => {
        expect(PixKey.isValidType(type)).toBe(true);
      },
    );

    it.each(["banana", "", "unknown", null, undefined])(
      "rejeita %p",
      (type) => {
        expect(PixKey.isValidType(type as any)).toBe(false);
      },
    );
  });

  describe("validação de formato por tipo", () => {
    it("aceita CPF de 11 dígitos", () => {
      const key = new PixKey("12345678909", PixKeyType.CPF);
      expect(key.type).toBe(PixKeyType.CPF);
    });

    it("recusa CPF com formato inválido", () => {
      expect(() => new PixKey("123", "cpf")).toThrow(InvalidArgumentError);
    });

    it("aceita email válido", () => {
      expect(() => new PixKey("musico@pix.com", "email")).not.toThrow();
    });

    it("recusa email inválido", () => {
      expect(() => new PixKey("nao-e-email", "email")).toThrow(
        InvalidArgumentError,
      );
    });

    it("aceita telefone E.164", () => {
      expect(() => new PixKey("+5511999999999", "phone")).not.toThrow();
    });

    it("aceita chave aleatória UUID", () => {
      expect(
        () => new PixKey("123e4567-e89b-12d3-a456-426614174000", "random"),
      ).not.toThrow();
    });

    it("recusa chave vazia", () => {
      expect(() => new PixKey("", "random")).toThrow(InvalidArgumentError);
    });
  });
});
