export type AsaasWebhookEvent =
  | "PAYMENT_RECEIVED"
  | "PAYMENT_CONFIRMED"
  | "PAYMENT_OVERDUE"
  | "PAYMENT_REFUNDED"
  | "TRANSFER_DONE"
  | "TRANSFER_FAILED"
  | "TRANSFER_CANCELLED"
  | string;

export type AsaasPaymentWebhookPayload = {
  id: string;
  externalReference?: string | null;
  value: number;
  netValue: number;
  billingType: string;
  status: string;
};

export type AsaasTransferWebhookPayload = {
  id: string;
  externalReference?: string | null;
  value: number;
  status: string;
  failReason?: string | null;
};

export type AsaasWebhookBody = {
  event: AsaasWebhookEvent;
  payment?: AsaasPaymentWebhookPayload;
  transfer?: AsaasTransferWebhookPayload;
};
