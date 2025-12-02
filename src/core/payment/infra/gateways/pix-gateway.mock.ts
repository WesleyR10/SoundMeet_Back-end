import { IPixGateway, PixPaymentRequest, PixPaymentResponse } from "./pix-gateway.interface";

export class PixGatewayMock implements IPixGateway {
  async generatePayment(input: PixPaymentRequest): Promise<PixPaymentResponse> {
    return {
      qr_code: "mock_qr_code_base64",
      copy_paste_code: "mock_copy_paste_code",
      external_id: `mock_${Date.now()}`,
    };
  }
}
