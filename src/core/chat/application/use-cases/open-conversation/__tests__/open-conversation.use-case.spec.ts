import { v4 as uuidv4 } from "uuid";

import { ConversationInMemoryRepository } from "../../../../infra/db/in-memory/conversation-in-memory.repository";
import { OpenConversationUseCase } from "../open-conversation.use-case";

describe("OpenConversationUseCase", () => {
  let convRepo: ConversationInMemoryRepository;
  let useCase: OpenConversationUseCase;

  const inquiryId = uuidv4();
  const establishmentId = uuidv4();
  const musicianId = uuidv4();

  beforeEach(() => {
    convRepo = new ConversationInMemoryRepository();
    useCase = new OpenConversationUseCase(convRepo);
  });

  it("should create a new conversation when none exists for the inquiry", async () => {
    const out = await useCase.execute({
      inquiry_id: inquiryId,
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    expect(out.conversation_id).toBeDefined();
    expect(out.already_existed).toBe(false);
    expect(convRepo.items).toHaveLength(1);
  });

  it("should return already_existed false for a brand new conversation", async () => {
    const out = await useCase.execute({
      inquiry_id: uuidv4(),
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    expect(out.already_existed).toBe(false);
  });

  it("should return the existing conversation when called again with the same inquiry_id", async () => {
    const first = await useCase.execute({
      inquiry_id: inquiryId,
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    const second = await useCase.execute({
      inquiry_id: inquiryId,
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    expect(second.conversation_id).toBe(first.conversation_id);
    expect(second.already_existed).toBe(true);
    expect(convRepo.items).toHaveLength(1);
  });

  it("should return already_existed true for existing conversation", async () => {
    await useCase.execute({
      inquiry_id: inquiryId,
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    const out = await useCase.execute({
      inquiry_id: inquiryId,
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    expect(out.already_existed).toBe(true);
  });

  it("should create independent conversations for different inquiry_ids", async () => {
    await useCase.execute({
      inquiry_id: uuidv4(),
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    await useCase.execute({
      inquiry_id: uuidv4(),
      establishment_id: establishmentId,
      musician_id: musicianId,
      band_id: null,
    });

    expect(convRepo.items).toHaveLength(2);
  });
});

/**
 * A segunda porta da negociação.
 *
 * Até 17/set/2026 só a inquiry abria canal, e a razão era o schema, não o
 * produto: `conversations.inquiry_id` era NOT NULL. Quem recebia uma proposta
 * de show com data e cachê não tinha onde responder "pode ser 22h?".
 */
describe("OpenConversationUseCase — proposta de show", () => {
  let convRepo: ConversationInMemoryRepository;
  let useCase: OpenConversationUseCase;

  const establishmentId = uuidv4();
  const musicianId = uuidv4();
  const bookingId = uuidv4();

  const base = {
    establishment_id: establishmentId,
    musician_id: musicianId,
    band_id: null,
  };

  beforeEach(() => {
    convRepo = new ConversationInMemoryRepository();
    useCase = new OpenConversationUseCase(convRepo);
  });

  it("abre a conversa a partir de um booking", async () => {
    const out = await useCase.execute({ ...base, booking_id: bookingId });

    expect(out.already_existed).toBe(false);
    expect(convRepo.items).toHaveLength(1);
    expect(convRepo.items[0]!.booking_id).toBe(bookingId);
    expect(convRepo.items[0]!.inquiry_id).toBeNull();
  });

  it("🔴 é IDEMPOTENTE pelo booking — o handler de evento pode reentrar", async () => {
    // `booking_id` é `@unique`: sem a leitura antes do insert, a segunda
    // execução levaria violação de constraint e o `catch` do handler só a
    // registraria no log.
    const first = await useCase.execute({ ...base, booking_id: bookingId });
    const second = await useCase.execute({ ...base, booking_id: bookingId });

    expect(second.conversation_id).toBe(first.conversation_id);
    expect(second.already_existed).toBe(true);
    expect(convRepo.items).toHaveLength(1);
  });

  it("não confunde as duas origens: mesmo id como inquiry e como booking", async () => {
    const mesmoId = uuidv4();

    await useCase.execute({ ...base, inquiry_id: mesmoId });
    await useCase.execute({ ...base, booking_id: mesmoId });

    expect(convRepo.items).toHaveLength(2);
  });

  it("🔴 recusa a chamada SEM origem nenhuma", async () => {
    await expect(useCase.execute({ ...base })).rejects.toThrow(
      /exactly one of inquiry_id or booking_id/,
    );
    expect(convRepo.items).toHaveLength(0);
  });

  it("🔴 recusa a chamada com AS DUAS origens", async () => {
    await expect(
      useCase.execute({ ...base, inquiry_id: uuidv4(), booking_id: bookingId }),
    ).rejects.toThrow(/exactly one of inquiry_id or booking_id/);
    expect(convRepo.items).toHaveLength(0);
  });

  it("trata `null` explícito como ausência, não como origem", async () => {
    // Os handlers passam só o campo que conhecem; o outro chega `undefined`.
    // Um `null` explícito vindo de um chamador distraído não pode virar origem.
    await expect(
      useCase.execute({ ...base, inquiry_id: null, booking_id: null }),
    ).rejects.toThrow(/exactly one of inquiry_id or booking_id/);
  });
});
