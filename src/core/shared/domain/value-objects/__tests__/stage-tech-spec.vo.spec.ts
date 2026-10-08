import {
  InvalidStageTechSpecError,
  STAGE_TECH_SPEC_MAX_BACKLINE_ITEMS,
  STAGE_TECH_SPEC_MAX_NOTES_LENGTH,
  StageTechSpec,
} from "../stage-tech-spec.vo";

describe("StageTechSpec Value Object", () => {
  it("should create a fully populated spec", () => {
    const spec = new StageTechSpec({
      hasPa: true,
      mixerChannels: 12,
      monitors: 2,
      hasMicrophones: 4,
      backline: ["Bateria", "Cubo de guitarra"],
      dimensions: { widthM: 5, depthM: 3, heightM: 2.5 },
      power: { outlets: 6, voltage: "110V/220V" },
      hasParking: true,
      hasSoundEngineer: false,
      soundcheckWindow: "18:00-19:00",
      notes: "Palco no fundo do salão",
    });

    expect(spec.hasPa).toBe(true);
    expect(spec.mixerChannels).toBe(12);
    expect(spec.backline).toEqual(["Bateria", "Cubo de guitarra"]);
    expect(spec.dimensions).toEqual({ widthM: 5, depthM: 3, heightM: 2.5 });
    expect(spec.power).toEqual({ outlets: 6, voltage: "110V/220V" });
    expect(spec.soundcheckWindow).toBe("18:00-19:00");
    expect(spec.isEmpty()).toBe(false);
  });

  // Regra central da feature: meia ficha vale mais que ficha nenhuma.
  it("should accept an empty spec with every field defaulting to null", () => {
    const spec = new StageTechSpec({});

    expect(spec.hasPa).toBeNull();
    expect(spec.mixerChannels).toBeNull();
    expect(spec.dimensions).toBeNull();
    expect(spec.power).toBeNull();
    expect(spec.backline).toEqual([]);
    expect(spec.isEmpty()).toBe(true);
  });

  it("should accept a partially filled spec", () => {
    const spec = new StageTechSpec({ hasPa: true });

    expect(spec.hasPa).toBe(true);
    expect(spec.monitors).toBeNull();
    expect(spec.isEmpty()).toBe(false);
  });

  // `false` é informação ("não tem PA"), `null` é ausência de resposta.
  it("should distinguish an explicit false from a missing answer", () => {
    const spec = new StageTechSpec({ hasPa: false });

    expect(spec.hasPa).toBe(false);
    expect(spec.hasParking).toBeNull();
    expect(spec.isEmpty()).toBe(false);
  });

  describe("counts", () => {
    it("should accept zero as a legitimate answer", () => {
      const spec = new StageTechSpec({ monitors: 0 });

      expect(spec.monitors).toBe(0);
      expect(spec.isEmpty()).toBe(false);
    });

    it("should reject a negative count", () => {
      expect(() => new StageTechSpec({ mixerChannels: -1 })).toThrow(
        "mixerChannels cannot be negative.",
      );
    });

    it("should reject a non-integer count", () => {
      expect(() => new StageTechSpec({ monitors: 2.5 })).toThrow(
        "monitors must be an integer.",
      );
    });

    it("should reject an absurd count", () => {
      expect(() => new StageTechSpec({ hasMicrophones: 100_000 })).toThrow(
        InvalidStageTechSpecError,
      );
    });
  });

  describe("backline", () => {
    it("should trim, drop empties and dedupe case-insensitively preserving order", () => {
      const spec = new StageTechSpec({
        backline: ["  Bateria ", "", "bateria", "Cubo", "   "],
      });

      expect(spec.backline).toEqual(["Bateria", "Cubo"]);
    });

    it("should reject a non-string item", () => {
      expect(
        () => new StageTechSpec({ backline: [42 as unknown as string] }),
      ).toThrow("Backline items must be strings.");
    });

    it("should reject more items than the limit", () => {
      const backline = Array.from(
        { length: STAGE_TECH_SPEC_MAX_BACKLINE_ITEMS + 1 },
        (_, i) => `Item ${i}`,
      );

      expect(() => new StageTechSpec({ backline })).toThrow(
        InvalidStageTechSpecError,
      );
    });

    it("should reject an item longer than the limit", () => {
      expect(() => new StageTechSpec({ backline: ["a".repeat(61)] })).toThrow(
        InvalidStageTechSpecError,
      );
    });
  });

  describe("dimensions", () => {
    it("should collapse an all-null subestructure to null", () => {
      const spec = new StageTechSpec({
        dimensions: { widthM: null, depthM: null, heightM: null },
      });

      expect(spec.dimensions).toBeNull();
      expect(spec.isEmpty()).toBe(true);
    });

    it("should keep a partially filled subestructure", () => {
      const spec = new StageTechSpec({ dimensions: { widthM: 4 } });

      expect(spec.dimensions).toEqual({
        widthM: 4,
        depthM: null,
        heightM: null,
      });
    });

    it("should reject a zero or negative dimension", () => {
      expect(() => new StageTechSpec({ dimensions: { widthM: 0 } })).toThrow(
        "dimensions.widthM must be greater than zero.",
      );
      expect(() => new StageTechSpec({ dimensions: { depthM: -2 } })).toThrow(
        "dimensions.depthM must be greater than zero.",
      );
    });

    it("should reject an absurd dimension", () => {
      expect(
        () => new StageTechSpec({ dimensions: { heightM: 5000 } }),
      ).toThrow(InvalidStageTechSpecError);
    });
  });

  describe("power", () => {
    it("should collapse an all-empty subestructure to null", () => {
      const spec = new StageTechSpec({
        power: { outlets: null, voltage: "   " },
      });

      expect(spec.power).toBeNull();
    });

    it("should reject a negative outlet count", () => {
      expect(() => new StageTechSpec({ power: { outlets: -3 } })).toThrow(
        "power.outlets cannot be negative.",
      );
    });
  });

  describe("soundcheckWindow", () => {
    it.each(["18:00-19:00", "00:00-23:59", "07:30-08:00"])(
      "should accept %s",
      (window) => {
        expect(
          new StageTechSpec({ soundcheckWindow: window }).soundcheckWindow,
        ).toBe(window);
      },
    );

    it.each([
      "18:00",
      "18h-19h",
      "25:00-26:00",
      "18:60-19:00",
      "18:00 - 19:00",
    ])("should reject %s", (window) => {
      expect(() => new StageTechSpec({ soundcheckWindow: window })).toThrow(
        "Soundcheck window must be in the HH:MM-HH:MM format.",
      );
    });
  });

  describe("notes", () => {
    it("should normalize a blank string to null", () => {
      expect(new StageTechSpec({ notes: "   " }).notes).toBeNull();
    });

    it("should reject notes longer than the limit", () => {
      expect(
        () =>
          new StageTechSpec({
            notes: "a".repeat(STAGE_TECH_SPEC_MAX_NOTES_LENGTH + 1),
          }),
      ).toThrow(InvalidStageTechSpecError);
    });
  });

  describe("serialization", () => {
    // Par toJSON/fromJSON é o contrato da coluna Json — tem que fechar o ciclo.
    it("should round-trip through toJSON/fromJSON", () => {
      const original = new StageTechSpec({
        hasPa: true,
        mixerChannels: 8,
        monitors: 0,
        backline: ["Bateria"],
        dimensions: { widthM: 4, depthM: 3 },
        power: { outlets: 4, voltage: "220V" },
        hasParking: false,
        soundcheckWindow: "17:00-18:00",
        notes: "Sem escada até o palco",
      });

      const restored = StageTechSpec.fromJSON(original.toJSON());

      expect(restored.toJSON()).toEqual(original.toJSON());
    });

    it("should round-trip an empty spec", () => {
      const original = new StageTechSpec({});

      expect(StageTechSpec.fromJSON(original.toJSON()).isEmpty()).toBe(true);
    });

    it("should survive a JSON.parse(JSON.stringify()) trip, as the Json column does", () => {
      const original = new StageTechSpec({ hasPa: true, mixerChannels: 8 });
      const wire = JSON.parse(JSON.stringify(original.toJSON()));

      expect(StageTechSpec.fromJSON(wire).toJSON()).toEqual(original.toJSON());
    });

    it.each([null, undefined, "string", 42, []])(
      "should reject %p as JSON input",
      (json) => {
        expect(() => StageTechSpec.fromJSON(json)).toThrow(
          InvalidStageTechSpecError,
        );
      },
    );
  });
});
