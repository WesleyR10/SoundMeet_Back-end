import { Tip } from "../../../domain/tip.entity";

export type TipOutput = {
  id: string;
  audience_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  amount: number;
  message?: string | null;
  payment_method: string;
  status: string;
  transaction_id?: string | null;
  pix_key?: string | null;
  is_anonymous: boolean;
  show_in_wall: boolean;
  created_at: Date;
  updated_at: Date;
};

export class TipOutputMapper {
  static toOutput(entity: Tip): TipOutput {
    const { tip_id, ...otherProps } = entity.toJSON();
    return {
      id: tip_id,
      ...otherProps,
    } as TipOutput;
  }
}
