import { Indication } from "../../../domain/indication.aggregate";
import { IndicationStatus } from "../../../domain/indication-types";

export type IndicationOutput = {
  id: string;
  audience_id: string;
  musician_id: string;
  establishment_id: string;
  message: string | null;
  status: IndicationStatus;
  is_new: boolean;
  created_at: Date;
  updated_at: Date;
};

export class IndicationOutputMapper {
  static toOutput(entity: Indication): IndicationOutput {
    return {
      id: entity.indication_id.id,
      audience_id: entity.audience_id,
      musician_id: entity.musician_id,
      establishment_id: entity.establishment_id,
      message: entity.message,
      status: entity.status,
      is_new: entity.status === "new",
      created_at: entity.created_at,
      updated_at: entity.updated_at,
    };
  }
}
