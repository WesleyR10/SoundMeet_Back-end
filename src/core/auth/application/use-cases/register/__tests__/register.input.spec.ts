import { validate } from "class-validator";
import { RegisterInput } from "../register.input";

function buildInput(overrides: Partial<RegisterInput> = {}): RegisterInput {
  const input = new RegisterInput();
  input.name = "Fulano de Tal";
  input.email = "fulano@example.com";
  input.password = "Senha123";
  input.role = "musician";
  Object.assign(input, overrides);
  return input;
}

describe("RegisterInput validation (cpf/phone conditional by role)", () => {
  it("requires cpf and phone when role is musician", async () => {
    const input = buildInput({ role: "musician" });

    const errors = await validate(input);

    const errorProps = errors.map((e) => e.property);
    expect(errorProps).toEqual(expect.arrayContaining(["cpf", "phone"]));
  });

  it("passes when role is musician and cpf/phone are provided", async () => {
    const input = buildInput({
      role: "musician",
      cpf: "52998224725",
      phone: "11999999999",
    });

    const errors = await validate(input);

    expect(errors).toHaveLength(0);
  });

  it("does not require cpf/phone when role is audience", async () => {
    const input = buildInput({ role: "audience" });

    const errors = await validate(input);

    const errorProps = errors.map((e) => e.property);
    expect(errorProps).not.toEqual(expect.arrayContaining(["cpf", "phone"]));
  });
});
