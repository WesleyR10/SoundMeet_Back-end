import { Uuid } from "../../../../shared/domain";
import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import {
  EventMusician,
  EventMusicianId,
  EventMusicianStatus,
} from "../../../domain";
import { EventMusicianModel } from "./event-musician-model";

export class EventMusicianModelMapper {
  static toModel(entity: EventMusician): EventMusicianModel {
    return {
      id: entity.event_musician_id.id,
      eventId: entity.event_id.id,
      musicianId: entity.musician_id?.id ?? null,
      bandId: entity.band_id?.id ?? null,
      fee: entity.fee,
      status: entity.status,
      startTime: entity.start_at,
      endTime: entity.end_at,
      created_at: entity.created_at,
    };
  }

  static toEntity(model: EventMusicianModel): EventMusician {
    const entity = new EventMusician({
      event_musician_id: new EventMusicianId(model.id),
      event_id: new Uuid(model.eventId),
      musician_id: model.musicianId ? new Uuid(model.musicianId) : null,
      band_id: model.bandId ? new Uuid(model.bandId) : null,
      /*
       * `fee` é `Decimal? @db.Decimal(12, 2)` no Prisma (schema.prisma:451) —
       * o driver devolve um objeto Decimal, não um number. Sem esta conversão,
       * o `@IsNumber()/@Min(0)` do `EventMusicianRules` recusava o objeto e o
       * `toEntity` lançava `LoadEntityError`: um único performer com cachê
       * gravado tornava `GET .../performers` um 422 permanente, para o line-up
       * inteiro. Verificado por HTTP em 08/ago/2026, antes do W2.4.
       *
       * O `as any` do repositório escondia isto do compilador — o
       * `EventMusicianModel` declara `fee: number | null`, que nunca foi
       * verdade em runtime.
       *
       * Mesma conversão de `booking-model-mapper.ts:64`, que tem a mesma
       * coluna Decimal e já fazia certo.
       */
      fee: model.fee !== null ? Number(model.fee) : null,
      status: model.status as EventMusicianStatus,
      start_at: model.startTime,
      end_at: model.endTime,
      created_at: model.created_at,
    });

    entity.validate();
    if (entity.notification.hasErrors()) {
      throw new LoadEntityError(entity.notification.toJSON());
    }

    return entity;
  }
}
