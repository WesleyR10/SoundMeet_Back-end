import { Transform } from "class-transformer";

import { TipOutput } from "../../core/payment/application/use-cases/common/tip-output";
import { ConfirmTipPaymentOutput } from "../../core/payment/application/use-cases/confirm-tip-payment/confirm-tip-payment.use-case";
import { GetMusicianTipsOutput } from "../../core/payment/application/use-cases/get-musician-tips/get-musician-tips.use-case";
import { GetMusicianWalletOutput } from "../../core/payment/application/use-cases/get-musician-wallet/get-musician-wallet.use-case";
import { SendTipOutput } from "../../core/payment/application/use-cases/send-tip/send-tip.use-case";
import { WithdrawToPixOutput } from "../../core/payment/application/use-cases/withdraw-to-pix/withdraw-to-pix.use-case";

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
    this.pix_key = output.pix_key;
    this.bank_account = output.bank_account;
    this.is_active = output.is_active;
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
