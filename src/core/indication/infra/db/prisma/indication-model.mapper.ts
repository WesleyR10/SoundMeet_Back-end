import { LoadEntityError } from "../../../../shared/domain/validators/validation.error";
import { Indication, IndicationId } from "../../../domain/indication.aggregate";
import { IndicationStatus } from "../../../domain/indication-types";

export type IndicationModel = {
  id: string;
  audience_id: string;
  musician_id: string;
  establishment_id: string;
  message: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
};

export class IndicationModelMapper {
  static toModel(entity: Indication): IndicationModel {
    return {
      id: entity.indication_id.id,
      audience_id: entity.audience_id,
      musician_id: entity.musician_id,
      establishment_id: entity.establishment_id,
      message: entity.message,
      status: entity.status,
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }

  static toEntity(model: IndicationModel): Indication {
    const indication = new Indication({
      indication_id: new IndicationId(model.id),
      audience_id: model.audience_id,
      musician_id: model.musician_id,
      establishment_id: model.establishment_id,
      message: model.message,
      status: model.status as IndicationStatus,
      created_at: model.created_at,
      updated_at: model.updated_at,
    });

    // `status` é String no banco (não enum), pelo mesmo motivo de `Review`:
    // é escopo de produto em evolução. Logo, uma linha corrompida só aparece
    // aqui — falhar na carga é melhor do que propagar lixo para a caixa de
    // entrada do estabelecimento.
    indication.validate();
    if (indication.notification.hasErrors()) {
      throw new LoadEntityError(indication.notification.toJSON());
    }

    return indication;
  }
}
