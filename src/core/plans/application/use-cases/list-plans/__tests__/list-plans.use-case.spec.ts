import {
  ESTABLISHMENT_PLAN_FEATURES,
  ESTABLISHMENT_PLAN_PRICING,
  MUSICIAN_PLAN_FEATURES,
  MUSICIAN_PLAN_PRICING,
} from "../../../../domain/plan-features.config";
import {
  EstablishmentPlanTier,
  MusicianPlanTier,
} from "../../../../domain/plan-tier.enum";
import { ListPlansUseCase } from "../list-plans.use-case";

describe("ListPlansUseCase Unit Tests", () => {
  const useCase = new ListPlansUseCase();

  it("retorna os 3 tiers de músico com pricing e features do config central", async () => {
    const output = await useCase.execute();

    expect(output.musician).toHaveLength(3);
    const essential = output.musician.find(
      (p) => p.tier === MusicianPlanTier.ESSENTIAL,
    );
    expect(essential?.pricing).toEqual(
      MUSICIAN_PLAN_PRICING[MusicianPlanTier.ESSENTIAL],
    );
    // O catálogo público é um subconjunto FIEL do config (omite os campos de
    // antifraude): o config contém tudo que o output expõe, com os mesmos valores.
    expect(MUSICIAN_PLAN_FEATURES[MusicianPlanTier.ESSENTIAL]).toMatchObject(
      essential!.features,
    );
  });

  it("retorna os 3 tiers de estabelecimento com pricing e features do config central", async () => {
    const output = await useCase.execute();

    expect(output.establishment).toHaveLength(3);
    const pro = output.establishment.find(
      (p) => p.tier === EstablishmentPlanTier.PRO,
    );
    expect(pro?.pricing).toEqual(
      ESTABLISHMENT_PLAN_PRICING[EstablishmentPlanTier.PRO],
    );
    expect(pro?.features).toEqual(
      ESTABLISHMENT_PLAN_FEATURES[EstablishmentPlanTier.PRO],
    );
  });

  it("anuncia como coming_soon toda feature sem capacidade por trás (9.7a)", async () => {
    const output = await useCase.execute();

    // Trava o contrato que as UIs consomem para escrever "em breve". Se alguém
    // implementar a capacidade de verdade e esquecer de tirar a chave daqui, o
    // produto continua dizendo "em breve" para algo que já entrega — e este
    // teste é o lugar onde isso aparece.
    expect(output.coming_soon.musician).toEqual(["api_access", "white_label"]);
    expect(output.coming_soon.establishment).toEqual(["api_access"]);
  });

  it("não anuncia mais QR codes por plano — o domínio nunca suportou (9.7a)", async () => {
    const output = await useCase.execute();

    // `max_qr_codes` (1/3/∞) esteve no catálogo de jun/2026 a ago/2026 sem
    // lastro: `Establishment.qr_code` é campo único e `generateQRCode()`
    // sobrescreve. A promessa saiu; múltiplos QR volta como feature, não gate.
    for (const entry of output.establishment) {
      expect(entry.features).not.toHaveProperty("max_qr_codes");
    }
  });

  it("🔴 NÃO expõe os campos de antifraude do saque (catálogo é público)", async () => {
    const output = await useCase.execute();

    // Revelar o teto e o velocity exatos no catálogo anônimo entregaria o mapa
    // para drenar logo abaixo do limite. Devem sair só na esfera do dono.
    for (const entry of output.musician) {
      expect(entry.features).not.toHaveProperty("max_withdrawal_per_day_brl");
      expect(entry.features).not.toHaveProperty("max_withdrawals_per_day");
    }
    // Os limites que SÃO de produto continuam presentes.
    for (const entry of output.musician) {
      expect(entry.features).toHaveProperty("min_withdrawal_amount_brl");
      expect(entry.features).toHaveProperty("withdrawal_days");
    }
  });

  it("é a única fonte de valores — não hardcoda nada fora de plan-features.config", async () => {
    const output = await useCase.execute();

    // Se alguém mudar um preço no config central, este teste reflete a
    // mudança automaticamente — é o contrato que substitui o espelho no mobile.
    for (const tier of Object.values(MusicianPlanTier)) {
      const entry = output.musician.find((p) => p.tier === tier);
      expect(entry?.pricing.monthly_price_brl).toBe(
        MUSICIAN_PLAN_PRICING[tier].monthly_price_brl,
      );
    }
  });
});
