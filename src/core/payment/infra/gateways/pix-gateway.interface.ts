export type PixPaymentRequest = {
  amount: number;
  description?: string;
  payer?: { id?: string; name?: string };
  metadata?: Record<string, any>;
};

export type PixPaymentResponse = {
  qr_code: string;
  copy_paste_code: string;
  external_id?: string;
};

export interface IPixGateway {
  generatePayment(input: PixPaymentRequest): Promise<PixPaymentResponse>;
}
