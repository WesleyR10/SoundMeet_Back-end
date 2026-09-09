import { MusicianIndicatedEvent } from "../../../core/audience/domain/events/musician-indicated.event";
import { SocialMediaSharedEvent } from "../../../core/audience/domain/events/social-media-shared.event";
import { PointsSourceEnum } from "../../../core/gamification/domain/value-objects/points-source.vo";
import { ScoreTypeEnum } from "../../../core/gamification/domain/value-objects/score-type.vo";
import { Uuid } from "../../../core/shared/domain/value-objects/uuid.vo";
import { AudienceEventsHandlers } from "../audience-events.handlers";

const AUDIENCE_ID = "123e4567-e89b-42d3-a456-426614174000";
const MUSICIAN_ID = "223e4567-e89b-42d3-a456-426614174001";
const ESTABLISHMENT_ID = "323e4567-e89b-42d3-a456-426614174002";
const CONTENT_ID = "423e4567-e89b-42d3-a456-426614174003";

function build(alreadyCredited = false) {
  const addPointsUseCase = { execute: jest.fn().mockResolvedValue(undefined) };
  const userScoreRepo = {
    existsByUserTypeAndReference: jest.fn().mockResolvedValue(alreadyCredited),
  };
  const recordIndicationUseCase = {
    execute: jest.fn().mockResolvedValue(undefined),
  };
  const handlers = new AudienceEventsHandlers(
    addPointsUseCase as never,
    userScoreRepo as never,
    recordIndicationUseCase as never,
  );
  return { handlers, addPointsUseCase, userScoreRepo, recordIndicationUseCase };
}

const shareEvent = () =>
  new SocialMediaSharedEvent(
    new Uuid(AUDIENCE_ID),
    "tip_receipt",
    CONTENT_ID,
    "instagram",
  );

const indicationEvent = () =>
  new MusicianIndicatedEvent(
    new Uuid(AUDIENCE_ID),
    ESTABLISHMENT_ID,
    MUSICIAN_ID,
    "Toca muito, encaixa no seu público",
  );

describe("AudienceEventsHandlers — compartilhamento social", () => {
  /*
   * 🔴 O teste que existe porque a ação é 100% auto-declarada: o SO não
   * distingue "compartilhou" de "abriu o menu e cancelou" (está escrito no
   * próprio `imageShare.ts` do app). Sem dedupe, um laço sobre a rota rende
   * pontos infinitos — e o leaderboard é público.
   */
  it("credita uma vez e NÃO credita de novo o mesmo conteúdo", async () => {
    const first = build(false);
    await first.handlers.handleSocialMediaShared(shareEvent());
    expect(first.addPointsUseCase.execute).toHaveBeenCalledTimes(1);

    const second = build(true);
    await second.handlers.handleSocialMediaShared(shareEvent());
    expect(second.addPointsUseCase.execute).not.toHaveBeenCalled();
  });

  it("consulta o ledger com as TRÊS colunas — usuário, tipo e referência", async () => {
    // Só (user, tipo) bloquearia o segundo compartilhamento de QUALQUER
    // conteúdo; só a referência bloquearia o crédito de OUTRO usuário sobre o
    // mesmo card. As três juntas são o que define "este conteúdo, por esta
    // pessoa".
    const { handlers, userScoreRepo } = build();
    await handlers.handleSocialMediaShared(shareEvent());

    expect(userScoreRepo.existsByUserTypeAndReference).toHaveBeenCalledWith(
      AUDIENCE_ID,
      ScoreTypeEnum.SOCIAL_SHARE,
      `tip_receipt:${CONTENT_ID}`,
    );
  });

  it("prefixa a referência com o tipo — ids de domínios diferentes não colidem", async () => {
    const { handlers, addPointsUseCase } = build();
    await handlers.handleSocialMediaShared(shareEvent());

    const metadata = addPointsUseCase.execute.mock.calls[0][0].metadata;
    expect(metadata.reference_id).toBe(`tip_receipt:${CONTENT_ID}`);
  });

  it("credita conteúdos DIFERENTES separadamente", async () => {
    const { handlers, addPointsUseCase } = build(false);

    await handlers.handleSocialMediaShared(shareEvent());
    await handlers.handleSocialMediaShared(
      new SocialMediaSharedEvent(
        new Uuid(AUDIENCE_ID),
        "show_recap",
        CONTENT_ID,
        "instagram",
      ),
    );

    expect(addPointsUseCase.execute).toHaveBeenCalledTimes(2);
  });

  it("usa a fonte SOCIAL_SHARE", async () => {
    const { handlers, addPointsUseCase } = build();
    await handlers.handleSocialMediaShared(shareEvent());
    expect(addPointsUseCase.execute.mock.calls[0][0].source).toBe(
      PointsSourceEnum.SOCIAL_SHARE,
    );
  });

  /*
   * A gamificação é acessória ao ato: o agregado já foi salvo quando o evento
   * dispara. Deixar a exceção subir derrubaria o compartilhamento por causa de
   * pontos — mesma postura do handler de request.
   */
  it("falha de pontos não propaga", async () => {
    const { handlers, addPointsUseCase } = build(false);
    addPointsUseCase.execute.mockRejectedValue(new Error("ledger fora do ar"));

    await expect(
      handlers.handleSocialMediaShared(shareEvent()),
    ).resolves.toBeUndefined();
  });
});

describe("AudienceEventsHandlers — indicação de músico", () => {
  it("credita uma vez por (músico, estabelecimento)", async () => {
    const first = build(false);
    await first.handlers.handleMusicianIndicated(indicationEvent());
    expect(first.addPointsUseCase.execute).toHaveBeenCalledTimes(1);

    // Indicar o mesmo músico para o mesmo lugar de novo é a mesma opinião,
    // repetida — não uma indicação nova.
    const second = build(true);
    await second.handlers.handleMusicianIndicated(indicationEvent());
    expect(second.addPointsUseCase.execute).not.toHaveBeenCalled();
  });

  it("a referência combina músico E estabelecimento", async () => {
    // Só o músico bloquearia indicá-lo para uma segunda casa, que é
    // justamente o comportamento desejado do produto.
    const { handlers, userScoreRepo } = build();
    await handlers.handleMusicianIndicated(indicationEvent());

    expect(userScoreRepo.existsByUserTypeAndReference).toHaveBeenCalledWith(
      AUDIENCE_ID,
      ScoreTypeEnum.INDICATION,
      `${MUSICIAN_ID}:${ESTABLISHMENT_ID}`,
    );
  });

  /*
   * 🔴 A indicação é o DADO de negócio — é o que alimenta a caixa de entrada do
   * estabelecimento. Os pontos do fã são acessórios. Antes de 28/set/2026 nada
   * era gravado: o evento era emitido e nenhum handler o escutava, então quem
   * indicou quem simplesmente sumia.
   */
  it("PERSISTE a indicação, com a mensagem", async () => {
    const { handlers, recordIndicationUseCase } = build();
    await handlers.handleMusicianIndicated(indicationEvent());

    expect(recordIndicationUseCase.execute).toHaveBeenCalledWith({
      audience_id: AUDIENCE_ID,
      musician_id: MUSICIAN_ID,
      establishment_id: ESTABLISHMENT_ID,
      message: "Toca muito, encaixa no seu público",
    });
  });

  it("persiste mesmo quando o crédito de pontos falha", async () => {
    // As duas coisas falham independentemente: perder a indicação por causa da
    // gamificação seria o pior resultado possível.
    const { handlers, addPointsUseCase, recordIndicationUseCase } =
      build(false);
    addPointsUseCase.execute.mockRejectedValue(new Error("ledger fora do ar"));

    await handlers.handleMusicianIndicated(indicationEvent());

    expect(recordIndicationUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it("credita mesmo quando a persistência falha", async () => {
    const { handlers, addPointsUseCase, recordIndicationUseCase } =
      build(false);
    recordIndicationUseCase.execute.mockRejectedValue(new Error("banco fora"));

    await handlers.handleMusicianIndicated(indicationEvent());

    expect(addPointsUseCase.execute).toHaveBeenCalledTimes(1);
  });

  it("usa a fonte INDICATION", async () => {
    const { handlers, addPointsUseCase } = build();
    await handlers.handleMusicianIndicated(indicationEvent());
    expect(addPointsUseCase.execute.mock.calls[0][0].source).toBe(
      PointsSourceEnum.INDICATION,
    );
  });

  it("falha de pontos não propaga", async () => {
    const { handlers, addPointsUseCase } = build(false);
    addPointsUseCase.execute.mockRejectedValue(new Error("ledger fora do ar"));

    await expect(
      handlers.handleMusicianIndicated(indicationEvent()),
    ).resolves.toBeUndefined();
  });
});
