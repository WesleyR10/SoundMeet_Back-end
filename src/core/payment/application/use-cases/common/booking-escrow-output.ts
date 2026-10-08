import { BookingEscrow } from "../../../domain/booking-escrow.aggregate";

export type BookingEscrowOutput = {
  id: string;
  booking_id: string;
  musician_id: string | null;
  amount: number;
  platform_fee: number;
  net_amount: number;
  status: string;
  expires_at: Date | null;
  held_at: Date | null;
  released_at: Date | null;
  refunded_at: Date | null;
  resolution_note: string | null;
  created_at: Date;
  updated_at: Date;
};

/**
 * 🔴 **`external_id` NÃO sai daqui.** É a referência da cobrança na instituição
 * de pagamento — o identificador com que se libera e se estorna dinheiro. O
 * músico não tem nada a fazer com ele, e expô-lo numa resposta HTTP põe em
 * circulação uma chave operacional de valor real. Mesmo raciocínio que mantém
 * `asaas_api_key` fora de `MusicianWallet.toJSON`.
 */
export class BookingEscrowOutputMapper {
  static toOutput(entity: BookingEscrow): BookingEscrowOutput {
    const {
      escrow_id,
      external_id: _external_id,
      ...otherProps
    } = entity.toJSON();

    return {
      id: escrow_id,
      ...otherProps,
    };
  }
}
