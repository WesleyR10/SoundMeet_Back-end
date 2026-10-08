import { EntityValidationError } from "../../../shared/domain/validators/validation.error";
import { Conversation } from "../conversation.aggregate";

const validProps = {
  inquiry_id: "f47ac10b-58cc-4372-a567-0e02b2c3d479" as string | null,
  booking_id: null as string | null,
  establishment_id: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
  musician_id: "f47ac10b-58cc-4372-a567-0e02b2c3d481",
  band_id: null as string | null,
};

describe("Conversation aggregate", () => {
  describe("create()", () => {
    it("should create a valid conversation with musician_id", () => {
      const conv = Conversation.create(validProps);
      expect(conv.conversation_id).toBeDefined();
      expect(conv.inquiry_id).toBe(validProps.inquiry_id);
      expect(conv.establishment_id).toBe(validProps.establishment_id);
      expect(conv.musician_id).toBe(validProps.musician_id);
      expect(conv.band_id).toBeNull();
    });

    it("should create a valid conversation with band_id (musician_id null)", () => {
      const conv = Conversation.create({
        ...validProps,
        musician_id: null,
        band_id: "f47ac10b-58cc-4372-a567-0e02b2c3d482",
      });
      expect(conv.band_id).toBe("f47ac10b-58cc-4372-a567-0e02b2c3d482");
      expect(conv.musician_id).toBeNull();
    });

    it("should throw EntityValidationError when inquiry_id is not a valid UUID", () => {
      expect(() =>
        Conversation.create({ ...validProps, inquiry_id: "not-a-uuid" }),
      ).toThrow(EntityValidationError);
    });

    it("should throw EntityValidationError when establishment_id is empty", () => {
      expect(() =>
        Conversation.create({ ...validProps, establishment_id: "" }),
      ).toThrow(EntityValidationError);
    });

    it("should assign a new conversation_id automatically", () => {
      const conv1 = Conversation.create(validProps);
      const conv2 = Conversation.create(validProps);
      expect(conv1.conversation_id.id).not.toBe(conv2.conversation_id.id);
    });

    it("should set created_at and updated_at to now by default", () => {
      const before = new Date();
      const conv = Conversation.create(validProps);
      const after = new Date();
      expect(conv.created_at.getTime()).toBeGreaterThanOrEqual(
        before.getTime(),
      );
      expect(conv.created_at.getTime()).toBeLessThanOrEqual(after.getTime());
    });
  });

  describe("toJSON()", () => {
    it("should return serializable object with all fields", () => {
      const conv = Conversation.create(validProps);
      const json = conv.toJSON();
      expect(json).toHaveProperty("conversation_id");
      expect(json).toHaveProperty("inquiry_id", validProps.inquiry_id);
      expect(json).toHaveProperty(
        "establishment_id",
        validProps.establishment_id,
      );
      expect(json).toHaveProperty("musician_id", validProps.musician_id);
      expect(json).toHaveProperty("band_id", null);
      expect(json).toHaveProperty("created_at");
      expect(json).toHaveProperty("updated_at");
    });
  });

  describe("fake()", () => {
    it("should build a valid Conversation instance", () => {
      const conv = Conversation.fake().aConversation().build();
      expect(conv).toBeInstanceOf(Conversation);
      expect(conv.conversation_id).toBeDefined();
      expect(conv.inquiry_id).toBeDefined();
    });

    it("should allow overriding establishment_id", () => {
      const conv = Conversation.fake()
        .aConversation()
        .withEstablishmentId("f47ac10b-58cc-4372-a567-0e02b2c3d480")
        .build();
      expect(conv.establishment_id).toBe(
        "f47ac10b-58cc-4372-a567-0e02b2c3d480",
      );
    });
  });
});

/**
 * A conversa pertence à NEGOCIAÇÃO, e uma negociação nasce de duas portas.
 *
 * Até 17/set/2026 `inquiry_id` era obrigatório, e isso não era decisão de
 * produto: era o schema (`conversations.inquiry_id` NOT NULL). A consequência
 * é que "propor um show" — a porta que manda data e cachê — não abria canal
 * nenhum, e o artista só podia aceitar o número ou recusar seco.
 */
describe("Conversation — origem da negociação", () => {
  const base = {
    establishment_id: "f47ac10b-58cc-4372-a567-0e02b2c3d480",
    musician_id: "f47ac10b-58cc-4372-a567-0e02b2c3d481",
    band_id: null,
  };
  const INQUIRY = "f47ac10b-58cc-4372-a567-0e02b2c3d479";
  const BOOKING = "f47ac10b-58cc-4372-a567-0e02b2c3d48a";

  it("aceita a conversa nascida de uma INQUIRY", () => {
    const conv = Conversation.create({
      ...base,
      inquiry_id: INQUIRY,
      booking_id: null,
    });

    expect(conv.inquiry_id).toBe(INQUIRY);
    expect(conv.booking_id).toBeNull();
  });

  it("aceita a conversa nascida de uma PROPOSTA DE SHOW", () => {
    const conv = Conversation.create({
      ...base,
      inquiry_id: null,
      booking_id: BOOKING,
    });

    expect(conv.booking_id).toBe(BOOKING);
    expect(conv.inquiry_id).toBeNull();
  });

  it("🔴 recusa a conversa ÓRFÃ — sem inquiry e sem booking", () => {
    // Uma conversa sem origem é um fio que ninguém sabe de onde veio nem para
    // onde volta: a UI não tem contexto nenhum para mostrar.
    expect(() =>
      Conversation.create({ ...base, inquiry_id: null, booking_id: null }),
    ).toThrow(EntityValidationError);
  });

  it("🔴 recusa a conversa com AS DUAS origens", () => {
    // Dois contextos e nenhuma regra para decidir qual a tela exibe.
    expect(() =>
      Conversation.create({
        ...base,
        inquiry_id: INQUIRY,
        booking_id: BOOKING,
      }),
    ).toThrow(EntityValidationError);
  });

  it("nomeia o erro no campo `negotiation_origin`", () => {
    try {
      Conversation.create({ ...base, inquiry_id: null, booking_id: null });
      throw new Error("deveria ter lançado");
    } catch (error: any) {
      expect(JSON.stringify(error.error ?? error)).toContain(
        "negotiation_origin",
      );
    }
  });

  it("a origem é checada TAMBÉM na validação parcial por campo", () => {
    /*
     * `validate(["musician_id"])` valida um campo só — mas a origem é
     * invariante do AGREGADO, não de um campo. Sem rodá-la sempre, um caminho
     * que revalidasse parcialmente daria "válido" para uma conversa órfã.
     */
    const conv = new Conversation({
      ...base,
      inquiry_id: null,
      booking_id: null,
    });

    expect(conv.validate(["musician_id"])).toBe(false);
    expect(conv.notification.hasErrors()).toBe(true);
  });

  it("`toJSON` expõe as duas origens — a UI escolhe o contexto por elas", () => {
    const json = Conversation.create({
      ...base,
      inquiry_id: null,
      booking_id: BOOKING,
    }).toJSON();

    expect(json).toHaveProperty("inquiry_id", null);
    expect(json).toHaveProperty("booking_id", BOOKING);
  });

  it("o fake builder troca de origem sem deixar as duas preenchidas", () => {
    const porBooking = Conversation.fake()
      .aConversation()
      .withBookingId(BOOKING)
      .build();
    expect(porBooking.booking_id).toBe(BOOKING);
    expect(porBooking.inquiry_id).toBeNull();

    const porInquiry = Conversation.fake()
      .aConversation()
      .withBookingId(BOOKING)
      .withInquiryId(INQUIRY)
      .build();
    expect(porInquiry.inquiry_id).toBe(INQUIRY);
    expect(porInquiry.booking_id).toBeNull();
  });
});
