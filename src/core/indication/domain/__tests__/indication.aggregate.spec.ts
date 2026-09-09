import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { Indication } from "../indication.aggregate";

const TRIO = {
  audience_id: "123e4567-e89b-42d3-a456-426614174000",
  musician_id: "223e4567-e89b-42d3-a456-426614174001",
  establishment_id: "323e4567-e89b-42d3-a456-426614174002",
};

describe("Indication", () => {
  it("nasce como 'new' — é a caixa de entrada de quem recebe", () => {
    const indication = Indication.create(TRIO);
    expect(indication.status).toBe("new");
    expect(indication.message).toBeNull();
  });

  it("guarda a mensagem, que é a parte útil da indicação", () => {
    const indication = Indication.create({
      ...TRIO,
      message: "Toca muito, encaixa no seu público",
    });
    expect(indication.message).toBe("Toca muito, encaixa no seu público");
  });

  it("recusa criação sem os três participantes", () => {
    expect(() => Indication.create({ ...TRIO, musician_id: "" })).toThrow(
      EntityValidationError,
    );
  });

  it("recusa mensagem acima de 1000 caracteres", () => {
    expect(() =>
      Indication.create({ ...TRIO, message: "x".repeat(1001) }),
    ).toThrow(EntityValidationError);
  });

  describe("estado da caixa de entrada", () => {
    it("markAsSeen move de new para seen", () => {
      const indication = Indication.create(TRIO);
      indication.markAsSeen();
      expect(indication.status).toBe("seen");
    });

    /*
     * 🔴 Arquivar é decisão final do estabelecimento. Se `markAsSeen`
     * pudesse desarquivar, a indicação voltaria à caixa sozinha — e quem
     * arquivou não teria como mantê-la fora.
     */
    it("markAsSeen NÃO ressuscita uma indicação arquivada", () => {
      const indication = Indication.create(TRIO);
      indication.archive();
      indication.markAsSeen();
      expect(indication.status).toBe("archived");
    });

    it("archive não apaga — a indicação continua existindo como sinal", () => {
      const indication = Indication.create(TRIO);
      indication.archive();
      expect(indication.status).toBe("archived");
      expect(indication.toJSON().audience_id).toBe(TRIO.audience_id);
    });
  });

  it("fake builder produz agregado válido", () => {
    const indication = Indication.fake().anIndication().build();
    indication.validate();
    expect(indication.notification.hasErrors()).toBe(false);
  });
});
