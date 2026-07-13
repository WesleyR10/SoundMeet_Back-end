import { CPF, InvalidCPFError } from "../cpf.vo";

describe("CPF Value Object", () => {
  describe("valid CPFs", () => {
    it("should accept a valid CPF with digits only", () => {
      const cpf = new CPF("52998224725");
      expect(cpf.value).toBe("52998224725");
    });

    it("should accept a valid CPF with mask and normalize to digits", () => {
      const cpf = new CPF("529.982.247-25");
      expect(cpf.value).toBe("52998224725");
    });

    it("should expose formatted value", () => {
      const cpf = new CPF("52998224725");
      expect(cpf.formatted).toBe("529.982.247-25");
    });

    it("should expose check digits", () => {
      const cpf = new CPF("52998224725");
      expect(cpf.checkDigits).toBe("25");
    });

    it("toString should return raw digits", () => {
      expect(new CPF("529.982.247-25").toString()).toBe("52998224725");
    });

    it("toJSON should include value, formatted and check_digits", () => {
      expect(new CPF("52998224725").toJSON()).toEqual({
        value: "52998224725",
        formatted: "529.982.247-25",
        check_digits: "25",
      });
    });
  });

  describe("invalid CPFs", () => {
    it("should reject empty value", () => {
      expect(() => new CPF("")).toThrow(InvalidCPFError);
    });

    it("should reject value with wrong length", () => {
      expect(() => new CPF("1234567890")).toThrow(
        new InvalidCPFError("CPF must have 11 digits"),
      );
    });

    it("should reject sequence of repeated digits", () => {
      expect(() => new CPF("11111111111")).toThrow(
        new InvalidCPFError("CPF cannot be a sequence of repeated digits"),
      );
    });

    it("should reject CPF with invalid first check digit", () => {
      expect(() => new CPF("52998224735")).toThrow(
        new InvalidCPFError("Invalid CPF"),
      );
    });

    it("should reject CPF with invalid second check digit", () => {
      expect(() => new CPF("52998224726")).toThrow(
        new InvalidCPFError("Invalid CPF"),
      );
    });
  });
});
