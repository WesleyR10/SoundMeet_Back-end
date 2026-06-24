export type PixWithdrawRequest = {
  amount: number;
  pix_key: string;
  pix_key_type: string;
  description?: string;
  external_reference?: string;
};

export type PixWithdrawResponse = {
  transfer_id: string;
  status: string;
};

export interface IPixWithdrawGateway {
  withdraw(input: PixWithdrawRequest): Promise<PixWithdrawResponse>;
}
