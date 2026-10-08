import {
  ALL_SCORE_TYPES,
  BADGE_TRACKS,
  badgeProgressFromLedger,
} from "../badge-tracks";
import { BadgeTypeEnum } from "../value-objects/badge-type.vo";
import { ScoreTypeEnum } from "../value-objects/score-type.vo";

describe("badge-tracks", () => {
  it("toda conquista do catálogo tem de onde tirar progresso", () => {
    for (const type of Object.values(BadgeTypeEnum)) {
      const track = BADGE_TRACKS[type];
      expect(track === ALL_SCORE_TYPES || track.length > 0).toBe(true);
    }
  });

  it("sem lançamento nenhum, tudo é zero", () => {
    const progress = badgeProgressFromLedger({});
    for (const type of Object.values(BadgeTypeEnum)) {
      expect(progress[type]).toBe(0);
    }
  });

  it("cada conquista soma só os tipos que escuta; as 'gerais' somam tudo", () => {
    const progress = badgeProgressFromLedger({
      [ScoreTypeEnum.QR_SCAN]: 30,
      [ScoreTypeEnum.REQUEST_SENT]: 75,
      [ScoreTypeEnum.REQUEST_ACCEPTED]: 50,
      [ScoreTypeEnum.TIP_GIVEN]: 40,
      [ScoreTypeEnum.INDICATION]: 15,
    });

    expect(progress[BadgeTypeEnum.INICIANTE_MUSICAL]).toBe(210);
    expect(progress[BadgeTypeEnum.SUPER_FA]).toBe(210);
    expect(progress[BadgeTypeEnum.SUGESTOR_CRIATIVO]).toBe(75);
    // Pedido ENVIADO não conta como acerto — só o aceito.
    expect(progress[BadgeTypeEnum.ACERTADOR]).toBe(50);
    expect(progress[BadgeTypeEnum.APOIADOR]).toBe(40);
    expect(progress[BadgeTypeEnum.MECENAS]).toBe(40);
    expect(progress[BadgeTypeEnum.DISCOVERER]).toBe(45);
    expect(progress[BadgeTypeEnum.SOCIALIZER]).toBe(0);
  });

  it("estorno lançado como negativo nunca deixa o progresso abaixo de zero", () => {
    const progress = badgeProgressFromLedger({
      [ScoreTypeEnum.TIP_GIVEN]: -20,
    });
    expect(progress[BadgeTypeEnum.APOIADOR]).toBe(0);
  });

  it("fração de real da gorjeta não vira ponto (coluna Int)", () => {
    const progress = badgeProgressFromLedger({
      [ScoreTypeEnum.TIP_GIVEN]: 12.5,
    });
    expect(progress[BadgeTypeEnum.APOIADOR]).toBe(12);
  });
});
