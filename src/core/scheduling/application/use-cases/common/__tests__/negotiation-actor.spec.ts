import { ForbiddenException } from "@nestjs/common";

import { Band, BandId } from "../../../../../musician/domain/band.aggregate";
import { IBandRepository } from "../../../../../musician/domain/band.repository";
import { BandInMemoryRepository } from "../../../../../musician/infra/db/in-memory/band-in-memory.repository";
import { Uuid } from "../../../../../shared/domain/value-objects/uuid.vo";
import {
  assertNegotiationParticipant,
  NegotiationActor,
  NegotiationSides,
} from "../negotiation-actor";

const ESTABLISHMENT = "11111111-1111-4111-8111-111111111111";
const MUSICIAN = "22222222-2222-4222-8222-222222222222";
const BAND = "33333333-3333-4333-8333-333333333333";
const OUTSIDER = "44444444-4444-4444-8444-444444444444";
const LEADER_SUB = "55555555-5555-4555-8555-555555555555";
const MEMBER_SUB = "66666666-6666-4666-8666-666666666666";

const sides: NegotiationSides = {
  establishment_id: ESTABLISHMENT,
  musician_id: MUSICIAN,
  band_id: null,
};

const bandSides: NegotiationSides = {
  establishment_id: ESTABLISHMENT,
  musician_id: null,
  band_id: BAND,
};

/**
 * Banda com um líder e um integrante comum, ambos com convite aceito — é a
 * configuração que separa "represento a banda" de "decido pela banda".
 */
function bandRepoWithLeader(
  leaderStatus: "accepted" | "pending" = "accepted",
): IBandRepository {
  const repo = new BandInMemoryRepository();
  const band = new Band({
    band_id: new BandId(BAND),
    name: "Trio Elétrico",
    genres: ["rock"],
    members: [
      {
        musician_id: new Uuid(LEADER_SUB),
        role: "leader",
        instrument: "guitarra",
        status: leaderStatus,
        joined_at: new Date(),
        responded_at: leaderStatus === "accepted" ? new Date() : null,
      },
      {
        musician_id: new Uuid(MEMBER_SUB),
        role: "member",
        instrument: "baixo",
        status: "accepted",
        joined_at: new Date(),
        responded_at: new Date(),
      },
    ],
  });
  void repo.insert(band);
  return repo;
}

const call = (
  actor: NegotiationActor,
  s: NegotiationSides = sides,
  bandRepo?: IBandRepository,
) => assertNegotiationParticipant(actor, s, "agir", bandRepo);

describe("assertNegotiationParticipant", () => {
  it("aceita o estabelecimento da negociação (id vem de establishment_ids)", async () => {
    await expect(
      call({ requesting_participant_ids: [OUTSIDER, ESTABLISHMENT] }),
    ).resolves.toBeUndefined();
  });

  it("aceita o músico da negociação", async () => {
    await expect(
      call({ requesting_participant_ids: [MUSICIAN] }),
    ).resolves.toBeUndefined();
  });

  it("recusa terceiro que só conhece os UUIDs", async () => {
    await expect(
      call({ requesting_participant_ids: [OUTSIDER] }),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("recusa quem tenta agir como banda sem o claim band_ids", async () => {
    await expect(
      call({ requesting_participant_ids: [OUTSIDER] }, bandSides),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("libera admin explicitamente", async () => {
    await expect(
      call({ requesting_participant_ids: [OUTSIDER], is_admin: true }),
    ).resolves.toBeUndefined();
  });

  it("não casa identidade com lado nulo da negociação", async () => {
    await expect(
      call(
        { requesting_participant_ids: [OUTSIDER] },
        {
          establishment_id: ESTABLISHMENT,
          musician_id: null,
          band_id: null,
        },
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it("pula a checagem sem ator — jobs internos de agenda", async () => {
    await expect(call({})).resolves.toBeUndefined();
    await expect(
      call({ requesting_participant_ids: [] }),
    ).resolves.toBeUndefined();
    // Strings vazias não são identidade: viram "sem ator", não um match falso.
    await expect(
      call({ requesting_participant_ids: [""] }),
    ).resolves.toBeUndefined();
  });

  describe("liderança de banda", () => {
    it("o líder decide pela banda", async () => {
      await expect(
        call(
          {
            requesting_participant_ids: [LEADER_SUB, BAND],
            requesting_musician_id: LEADER_SUB,
          },
          bandSides,
          bandRepoWithLeader(),
        ),
      ).resolves.toBeUndefined();
    });

    // O ponto da regra: o claim `band_ids` diz "faço parte", não "mando".
    it("integrante com o claim band_ids NÃO decide pela banda", async () => {
      await expect(
        call(
          {
            requesting_participant_ids: [MEMBER_SUB, BAND],
            requesting_musician_id: MEMBER_SUB,
          },
          bandSides,
          bandRepoWithLeader(),
        ),
      ).rejects.toThrow(/Somente o líder/);
    });

    it("líder com convite ainda pendente não decide", async () => {
      await expect(
        call(
          {
            requesting_participant_ids: [LEADER_SUB, BAND],
            requesting_musician_id: LEADER_SUB,
          },
          bandSides,
          bandRepoWithLeader("pending"),
        ),
      ).rejects.toThrow(/Somente o líder/);
    });

    // Falha fechada: sem repositório não há como provar liderança, e uma
    // fiação esquecida tem que virar 403 visível, não permissão silenciosa.
    it("nega quando não há repositório de bandas para verificar", async () => {
      await expect(
        call(
          {
            requesting_participant_ids: [LEADER_SUB, BAND],
            requesting_musician_id: LEADER_SUB,
          },
          bandSides,
        ),
      ).rejects.toThrow(/não foi possível verificar a liderança/i);
    });

    it("nega quando o ator não traz o `sub`", async () => {
      await expect(
        call(
          { requesting_participant_ids: [BAND] },
          bandSides,
          bandRepoWithLeader(),
        ),
      ).rejects.toThrow(/não foi possível verificar a liderança/i);
    });

    it("banda inexistente não autoriza ninguém", async () => {
      await expect(
        call(
          {
            requesting_participant_ids: [LEADER_SUB, BAND],
            requesting_musician_id: LEADER_SUB,
          },
          bandSides,
          new BandInMemoryRepository(),
        ),
      ).rejects.toBeInstanceOf(ForbiddenException);
    });

    // O estabelecimento não vira refém da regra da banda: ele age por si.
    it("o estabelecimento age sem passar pela checagem de liderança", async () => {
      await expect(
        call(
          { requesting_participant_ids: [ESTABLISHMENT] },
          bandSides,
          undefined,
        ),
      ).resolves.toBeUndefined();
    });

    it("admin continua passando por cima da liderança", async () => {
      await expect(
        call(
          { requesting_participant_ids: [OUTSIDER], is_admin: true },
          bandSides,
        ),
      ).resolves.toBeUndefined();
    });

    it("jobs internos sem ator não esbarram na liderança", async () => {
      await expect(call({}, bandSides)).resolves.toBeUndefined();
    });
  });
});
