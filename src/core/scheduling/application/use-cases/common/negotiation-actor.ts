import { ForbiddenException } from "@nestjs/common";

import { BandId } from "../../../../musician/domain/band.aggregate";
import { IBandRepository } from "../../../../musician/domain/band.repository";
import { Uuid } from "../../../../shared/domain/value-objects/uuid.vo";

/**
 * Ator de uma negociação de agenda, derivado exclusivamente do JWT.
 *
 * `requesting_participant_ids` carrega TODAS as identidades do usuário — o
 * `sub` (músico) mais os claims `establishment_ids` e `band_ids` — porque o id
 * que o identifica como parte da negociação depende do papel. Um único
 * `requesting_user_id` não dá conta: o estabelecimento não é o `sub`, e um
 * músico pode representar várias bandas.
 */
export type NegotiationActor = {
  requesting_participant_ids?: string[] | null;
  /**
   * O `sub` do JWT — a pessoa por trás das identidades acima. Vem separado
   * porque *representar* a banda (claim `band_ids`) não é o mesmo que *decidir*
   * por ela: a liderança é verificada contra este id, não contra o claim.
   */
  requesting_musician_id?: string | null;
  is_admin?: boolean;
};

export type NegotiationSides = {
  establishment_id?: string | null;
  musician_id?: string | null;
  band_id?: string | null;
};

/**
 * Exige que o ator seja um dos lados da negociação. IDs vindos do corpo da
 * requisição jamais substituem identidade: eles definem o alvo, e esta função
 * confirma que o autenticado tem direito de agir naquele alvo.
 *
 * Sem `requesting_participant_ids` a checagem é pulada — mesma convenção dos
 * demais use cases de scheduling, para jobs internos (expiração/conclusão
 * automática de bookings) que rodam sem ator HTTP.
 *
 * Quando o lado do ator é a banda, ser participante não basta: ver
 * `assertBandLeader`.
 */
export async function assertNegotiationParticipant(
  actor: NegotiationActor,
  sides: NegotiationSides,
  action: string,
  bandRepo?: IBandRepository,
): Promise<void> {
  if (actor.is_admin) {
    return;
  }

  const actorIds = (actor.requesting_participant_ids ?? []).filter(Boolean);
  if (actorIds.length === 0) {
    return;
  }

  const matchesEstablishment =
    !!sides.establishment_id && actorIds.includes(sides.establishment_id);
  const matchesMusician =
    !!sides.musician_id && actorIds.includes(sides.musician_id);
  const bandId = sides.band_id ?? null;
  const matchesBand = !!bandId && actorIds.includes(bandId);

  if (!matchesEstablishment && !matchesMusician && !matchesBand) {
    throw new ForbiddenException(
      `Você não tem permissão para ${action} em nome deste estabelecimento, músico ou banda.`,
    );
  }

  // Só exige liderança quando a banda é o ÚNICO vínculo do ator. Se ele também
  // é o estabelecimento ou o músico daquele lado da mesa, já está agindo por si.
  if (matchesBand && !matchesEstablishment && !matchesMusician) {
    await assertBandLeader(actor, bandId as string, action, bandRepo);
  }
}

/**
 * Versão de LEITURA (Bloco 9.2): exige que o ator seja um dos lados, **sem**
 * exigir liderança quando o vínculo é a banda.
 *
 * A diferença é deliberada: `assertNegotiationParticipant` protege *decisões*
 * (confirmar, cancelar, aceitar), e decidir pela banda é ato do líder. Abrir a
 * agenda para conferir um show não é decidir — todo integrante com o claim
 * `band_ids` precisa ver o que a banda tem marcado. Exigir liderança aqui
 * esconderia a própria agenda dos músicos da banda.
 *
 * Mantém a mesma convenção do irmão: admin passa, ator sem identidade nenhuma
 * (job interno) pula a checagem.
 */
export function assertNegotiationViewer(
  actor: NegotiationActor,
  sides: NegotiationSides,
  resource: string,
): void {
  if (actor.is_admin) {
    return;
  }

  const actorIds = (actor.requesting_participant_ids ?? []).filter(Boolean);
  if (actorIds.length === 0) {
    return;
  }

  const isParticipant = [
    sides.establishment_id,
    sides.musician_id,
    sides.band_id,
  ].some((id) => !!id && actorIds.includes(id));

  if (!isParticipant) {
    throw new ForbiddenException(
      `Você não tem permissão para ver ${resource}.`,
    );
  }
}

/**
 * A banda fecha o compromisso por todos os integrantes, então quem assume esse
 * compromisso é o líder. O claim `band_ids` diz apenas "faço parte desta
 * banda" — hoje só o criador o recebe, mas isso é circunstancial, e no dia em
 * que integrantes também receberem o claim (para ver a agenda, por exemplo)
 * esta checagem é o que impede qualquer um deles de aceitar um show sozinho.
 *
 * Falha fechada: sem repositório de bandas ou sem `sub` não há como provar a
 * liderança, e o correto é negar — um 403 visível expõe fiação faltando, uma
 * permissão silenciosa não.
 */
async function assertBandLeader(
  actor: NegotiationActor,
  bandId: string,
  action: string,
  bandRepo?: IBandRepository,
): Promise<void> {
  const musicianId = actor.requesting_musician_id?.trim();

  if (!bandRepo || !musicianId) {
    throw new ForbiddenException(
      `Não foi possível verificar a liderança da banda para ${action}.`,
    );
  }

  const band = await bandRepo.findById(new BandId(bandId));

  if (!band?.isLeader(new Uuid(musicianId))) {
    throw new ForbiddenException(`Somente o líder da banda pode ${action}.`);
  }
}
