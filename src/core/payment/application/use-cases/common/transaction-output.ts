import { Transaction } from "../../../domain/transaction.entity";

export type TransactionOutput = {
  id: string;
  user_id: string | null;
  musician_id: string | null;
  type: string;
  amount: number;
  fee: number;
  net_amount: number;
  status: string;
  payment_method: string;
  created_at: Date;
  updated_at: Date;
};

export class TransactionOutputMapper {
  static toOutput(entity: Transaction): TransactionOutput {
    const { transaction_id, ...otherProps } = entity.toJSON();
    return {
      id: transaction_id,
      ...otherProps,
    } as TransactionOutput;
  }
}
