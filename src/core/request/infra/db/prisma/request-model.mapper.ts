import { MusicRequestStatus, Prisma, RequestBoostStatus } from "@prisma/client";

import { Money } from "../../../../shared/domain/value-objects/money.vo";
import { Request, RequestId } from "../../../domain/request.aggregate";
import {
  RequestBoost,
  RequestBoostStatusEnum,
} from "../../../domain/value-objects/request-boost.vo";

export type RequestModelProps = {
  id: string;
  eventId: string;
  audienceId: string;
  musicianId: string;
  libraryId: string | null;
  songTitle: string;
  artistName: string;
  message: string | null;
  status: MusicRequestStatus;
  rejectionReason: string | null;
  priority: number;
  votesCount: number;
  playedAt: Date | null;
  respondedAt: Date | null;
  /**
   * União porque as duas pontas do mapper veem tipos diferentes: o `findMany`
   * devolve `Decimal`, o SQL cru do ramo `sort === "priority"` devolve número,
   * e o `toModel` escreve número. `Number(...)` no `toEntity` reconcilia os
   * três sem espalhar `Decimal` pelo domínio.
   */
  boostAmount?: Prisma.Decimal | number | null;
  boostDedication?: string | null;
  boostStatus?: RequestBoostStatus | null;
  boostTipId?: string | null;
  boostPromisedAt?: Date | null;
  boostChargedAt?: Date | null;
  boostPaidAt?: Date | null;
  created_at: Date;
  updated_at: Date;
};

export class RequestModelMapper {
  static toModel(entity: Request): RequestModelProps {
    const priority =
      entity.priority === "high" ? 2 : entity.priority === "medium" ? 1 : 0;

    return {
      id: entity.request_id.id,
      eventId: entity.event_id.id,
      audienceId: entity.audience_id.id,
      musicianId: entity.musician_id.id,
      libraryId: entity.library_id?.id ?? null,
      songTitle: entity.song_title.value,
      artistName: entity.artist || "",
      message: entity.message?.value || null,
      status: entity.status.value as MusicRequestStatus,
      rejectionReason: entity.rejection_reason,
      priority,
      votesCount: entity.votes_count,
      playedAt: entity.played_at,
      respondedAt: entity.responded_at,
      boostAmount: entity.boost?.amount.amount ?? null,
      boostDedication: entity.boost?.dedication ?? null,
      boostStatus: (entity.boost?.status ?? null) as RequestBoostStatus | null,
      boostTipId: entity.boost?.tip_id ?? null,
      boostPromisedAt: entity.boost?.promised_at ?? null,
      boostChargedAt: entity.boost?.charged_at ?? null,
      boostPaidAt: entity.boost?.paid_at ?? null,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  /**
   * O destaque só existe quando há valor E status.
   *
   * Guardar as duas condições (em vez de só o valor) evita ressuscitar um
   * destaque a partir de linha meio preenchida por migration ou seed — um
   * `RequestBoost` sem status cairia no default `promised` e voltaria a
   * destacar um pedido que já tinha vencido.
   */
  private static toBoost(model: RequestModelProps): RequestBoost | null {
    if (
      model.boostAmount === null ||
      model.boostAmount === undefined ||
      !model.boostStatus
    ) {
      return null;
    }

    return new RequestBoost({
      amount: new Money(Number(model.boostAmount)),
      dedication: model.boostDedication ?? null,
      status: model.boostStatus as unknown as RequestBoostStatusEnum,
      tip_id: model.boostTipId ?? null,
      promised_at: model.boostPromisedAt ?? undefined,
      charged_at: model.boostChargedAt ?? null,
      paid_at: model.boostPaidAt ?? null,
    });
  }

  static toEntity(model: RequestModelProps): Request {
    return new Request({
      request_id: new RequestId(model.id),
      event_id: model.eventId,
      audience_id: model.audienceId,
      musician_id: model.musicianId,
      library_id: model.libraryId,
      song_title: model.songTitle,
      artist: model.artistName || null,
      message: model.message || undefined,
      status: model.status,
      rejection_reason: model.rejectionReason,
      votes_count: model.votesCount,
      played_at: model.playedAt,
      created_at: model.created_at,
      updated_at: model.updated_at,
      responded_at: model.respondedAt,
      boost: RequestModelMapper.toBoost(model),
    });
  }
}
