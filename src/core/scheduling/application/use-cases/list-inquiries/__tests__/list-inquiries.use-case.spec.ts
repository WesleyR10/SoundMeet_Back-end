import { ForbiddenException } from "@nestjs/common";

import { Inquiry } from "../../../../domain/inquiry.aggregate";
import { InquiryInMemoryRepository } from "../../../../infra/db/in-memory/inquiry-in-memory.repository";
import { ListInquiriesUseCase } from "../list-inquiries.use-case";

const ESTABLISHMENT_A = "11111111-1111-4111-8111-111111111111";
const ESTABLISHMENT_B = "22222222-2222-4222-8222-222222222222";
const MUSICIAN_A = "33333333-3333-4333-8333-333333333333";
const MUSICIAN_B = "44444444-4444-4444-8444-444444444444";
const BAND_A = "55555555-5555-4555-8555-555555555555";

describe("ListInquiriesUseCase Unit Tests", () => {
  let repo: InquiryInMemoryRepository;
  let useCase: ListInquiriesUseCase;

  let inquiryAtoMusicianA: Inquiry;
  let inquiryBtoMusicianB: Inquiry;
  let inquiryAtoBandA: Inquiry;

  beforeEach(async () => {
    repo = new InquiryInMemoryRepository();
    useCase = new ListInquiriesUseCase(repo);

    inquiryAtoMusicianA = Inquiry.fake()
      .anInquiry()
      .withEstablishmentId(ESTABLISHMENT_A)
      .withMusicianId(MUSICIAN_A)
      .withBandId(null)
      .build();

    inquiryBtoMusicianB = Inquiry.fake()
      .anInquiry()
      .withEstablishmentId(ESTABLISHMENT_B)
      .withMusicianId(MUSICIAN_B)
      .withBandId(null)
      .build();

    inquiryAtoBandA = Inquiry.fake()
      .anInquiry()
      .withEstablishmentId(ESTABLISHMENT_A)
      .withMusicianId(null)
      .withBandId(BAND_A)
      .build();

    await repo.bulkInsert([
      inquiryAtoMusicianA,
      inquiryBtoMusicianB,
      inquiryAtoBandA,
    ]);
  });

  it("estabelecimento vê as propostas que enviou", async () => {
    const output = await useCase.execute({
      requesting_participant_ids: [ESTABLISHMENT_A],
    });

    expect(output.total).toBe(2);
  });

  it("músico vê as propostas que recebeu", async () => {
    const output = await useCase.execute({
      requesting_participant_ids: [MUSICIAN_A],
    });

    expect(output.total).toBe(1);
    expect(output.items[0].id).toBe(inquiryAtoMusicianA.entity_id.id);
  });

  it("não vaza proposta entre estabelecimentos distintos", async () => {
    const output = await useCase.execute({
      requesting_participant_ids: [ESTABLISHMENT_A],
    });

    expect(
      output.items.some((i) => i.id === inquiryBtoMusicianB.entity_id.id),
    ).toBe(false);
  });

  it("integrante vê a proposta feita à banda", async () => {
    const output = await useCase.execute({
      requesting_participant_ids: [MUSICIAN_A, BAND_A],
    });

    expect(output.total).toBe(2);
  });

  it("recusa ator sem nenhuma identidade utilizável (fail-closed)", async () => {
    await expect(
      useCase.execute({ requesting_participant_ids: [] }),
    ).rejects.toThrow(ForbiddenException);
  });

  it("admin vê tudo", async () => {
    const output = await useCase.execute({
      requesting_participant_ids: [ESTABLISHMENT_A],
      is_admin: true,
    });

    expect(output.total).toBe(3);
  });

  it("pedir establishment_id alheio não amplia o escopo", async () => {
    const output = await useCase.execute({
      requesting_participant_ids: [ESTABLISHMENT_A],
      establishment_id: ESTABLISHMENT_B,
    });

    expect(output.total).toBe(0);
  });
});
