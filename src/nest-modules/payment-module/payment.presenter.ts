import { ApiProperty } from "@nestjs/swagger";
import { Transform } from "class-transformer";

import { BookingEscrowOutput } from "../../core/payment/application/use-cases/common/booking-escrow-output";
import { TipOutput } from "../../core/payment/application/use-cases/common/tip-output";
import { ConfirmTipPaymentOutput } from "../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { GetMusicianEscrowsOutput } from "../../core/payment/application/use-cases/get-musician-escrows/get-musician-escrows.use-case";
import { GetMusicianTipsOutput } from "../../core/payment/application/use-cases/get-musician-tips/get-musician-tips.use-case";
import { GetMusicianWalletOutput } from "../../core/payment/application/use-cases/get-musician-wallet/get-musician-wallet.use-case";
import { GetTipOutput } from "../../core/payment/application/use-cases/get-tip/get-tip.use-case";
import { SendTipOutput } from "../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import { WithdrawToPixOutput } from "../../core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case";
import { BookingEscrowStatus } from "../../core/payment/domain/booking-escrow-enums";
import {
  maskBankAccount,
  maskSecretTail,
} from "../shared-module/masking/mask-secret";

export class SendTipPresenter {
  id: string;
  status: string;
  qr_code?: string;
  copy_paste_code?: string;

  constructor(output: SendTipOutput) {
    this.id = output.id;
    this.status = output.status;
    this.qr_code = output.qr_code;
    this.copy_paste_code = output.copy_paste_code;
  }
}

export class ConfirmTipPaymentPresenter {
  tip_id: string;
  transaction_id: string;
  wallet_balance: number;

  constructor(output: ConfirmTipPaymentOutput) {
    this.tip_id = output.tip_id;
    this.transaction_id = output.transaction_id;
    this.wallet_balance = output.wallet_balance;
  }
}

export class MusicianWalletPresenter {
  id: string;
  musician_id: string;
  balance: number;
  total_earned: number;
  total_withdrawn: number;
  pix_key: string | null;
  bank_account: any | null;
  is_active: boolean;
  /** Cachê em custódia — recebido, ainda não liberado. NÃO é sacável. */
  held_balance: number;
  /** Conta Mercado Pago vinculada (gorjeta cai direto nela). */
  mp_linked: boolean;
  min_withdrawal_amount_brl: number;
  withdrawal_days: number;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: GetMusicianWalletOutput) {
    this.id = output.id;
    this.musician_id = output.musician_id;
    this.balance = output.balance;
    this.total_earned = output.total_earned;
    this.total_withdrawn = output.total_withdrawn;
    // SM-016: nunca devolve pix_key/bank_account completos por HTTP, mesmo
    // atrás do MusicianOwnershipGuard — só o sufixo, como confirmação visual.
    this.pix_key = maskSecretTail(output.pix_key);
    this.bank_account = maskBankAccount(output.bank_account);
    this.is_active = output.is_active;
    this.held_balance = output.held_balance;
    this.mp_linked = output.mp_linked;
    this.min_withdrawal_amount_brl = output.min_withdrawal_amount_brl;
    this.withdrawal_days = output.withdrawal_days;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class TipPresenter {
  id: string;
  audience_id: string;
  musician_id?: string | null;
  band_id?: string | null;
  event_id?: string | null;
  amount: number;
  message?: string | null;
  payment_method: string;
  status: string;
  is_anonymous: boolean;
  show_in_wall: boolean;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: TipOutput) {
    this.id = output.id;
    this.audience_id = output.audience_id;
    this.musician_id = output.musician_id;
    this.band_id = output.band_id;
    this.event_id = output.event_id;
    this.amount = output.amount;
    this.message = output.message;
    this.payment_method = output.payment_method;
    this.status = output.status;
    this.is_anonymous = output.is_anonymous;
    this.show_in_wall = output.show_in_wall;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class TipsListPresenter {
  items: TipPresenter[];
  total: number;
  current_page: number;
  last_page: number;
  per_page: number;

  constructor(output: GetMusicianTipsOutput) {
    this.items = output.items.map((item) => new TipPresenter(item));
    this.total = output.total;
    this.current_page = output.current_page;
    this.last_page = output.last_page;
    this.per_page = output.per_page;
  }
}

export class WithdrawToPixPresenter {
  transaction_id: string;
  wallet_balance: number;
  status: string;
  min_withdrawal_amount_brl: number;
  withdrawal_days: number;

  constructor(output: WithdrawToPixOutput) {
    this.transaction_id = output.transaction_id;
    this.wallet_balance = output.wallet_balance;
    this.status = output.status;
    this.min_withdrawal_amount_brl = output.min_withdrawal_amount_brl;
    this.withdrawal_days = output.withdrawal_days;
  }
}

/**
 * Uma custódia de cachê, do ponto de vista do músico.
 *
 * 🔴 **Sem `external_id`.** O mapper de output já o remove; declará-lo aqui
 * reintroduziria a referência da cobrança no provedor numa resposta HTTP.
 */
export class BookingEscrowPresenter {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  booking_id: string;

  @ApiProperty({ description: "Cachê bruto acordado no contrato." })
  amount: number;

  @ApiProperty({ description: "Comissão — só vira receita na liberação." })
  platform_fee: number;

  @ApiProperty({ description: "O que o músico recebe." })
  net_amount: number;

  @ApiProperty({ enum: BookingEscrowStatus })
  status: string;

  @ApiProperty({
    nullable: true,
    description: "Quando o pagamento foi retido.",
  })
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  held_at: Date | null;

  @ApiProperty({ nullable: true })
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  released_at: Date | null;

  @ApiProperty({ nullable: true })
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  refunded_at: Date | null;

  @ApiProperty({
    nullable: true,
    description: "Quando a liberação automática do provedor vence.",
  })
  @Transform(
    ({ value }: { value: Date | null }) => value?.toISOString() ?? null,
  )
  expires_at: Date | null;

  @ApiProperty({
    nullable: true,
    description: "Motivo de estorno/contestação.",
  })
  resolution_note: string | null;

  @ApiProperty()
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;

  constructor(output: BookingEscrowOutput) {
    this.id = output.id;
    this.booking_id = output.booking_id;
    this.amount = output.amount;
    this.platform_fee = output.platform_fee;
    this.net_amount = output.net_amount;
    this.status = output.status;
    this.held_at = output.held_at;
    this.released_at = output.released_at;
    this.refunded_at = output.refunded_at;
    this.expires_at = output.expires_at;
    this.resolution_note = output.resolution_note;
    this.created_at = output.created_at;
  }
}

/**
 * ⚠️ Não estende `CollectionPresenter` — segue o formato de `TipsListPresenter`
 * (`{ items, total, ... }` dentro do envelope) porque é a outra lista da MESMA
 * tela da carteira, e duas formas de paginação lado a lado no mesmo cliente
 * seria pior que uma divergência já existente na API. Dívida registrada.
 */
export class EscrowsListPresenter {
  @ApiProperty({ type: [BookingEscrowPresenter] })
  items: BookingEscrowPresenter[];

  @ApiProperty()
  total: number;

  @ApiProperty()
  current_page: number;

  @ApiProperty()
  last_page: number;

  @ApiProperty()
  per_page: number;

  constructor(output: GetMusicianEscrowsOutput) {
    this.items = output.items.map((item) => new BookingEscrowPresenter(item));
    this.total = output.total;
    this.current_page = output.current_page;
    this.last_page = output.last_page;
    this.per_page = output.per_page;
  }
}

/**
 * Uma gorjeta, como o próprio FÃ a lê.
 *
 * Distinto do `TipPresenter` acima, que é a visão do MÚSICO na carteira dele
 * (lista, com nome do fã e flags de exibição no wall). Aqui é o oposto: quem
 * lê é quem pagou, e o que importa é o estado do pagamento e o código PIX para
 * concluí-lo. Nenhum dos dois expõe `pix_key` — chave de recebimento do músico
 * não é dado de leitura de terceiro.
 */
export class AudienceTipPresenter {
  id: string;
  status: string;
  amount: number;
  musician_id: string | null;
  band_id: string | null;
  event_id: string | null;
  message: string | null;
  qr_code: string | null;
  copy_paste_code: string | null;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  created_at: Date;
  @Transform(({ value }: { value: Date }) => value.toISOString())
  updated_at: Date;

  constructor(output: GetTipOutput) {
    this.id = output.id;
    this.status = output.status;
    this.amount = output.amount;
    this.musician_id = output.musician_id;
    this.band_id = output.band_id;
    this.event_id = output.event_id;
    this.message = output.message;
    this.qr_code = output.qr_code;
    this.copy_paste_code = output.copy_paste_code;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}
