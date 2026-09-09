import { IsObject, IsOptional, IsString } from "class-validator";

/**
 * Notificação do Mercado Pago.
 *
 * ⚠️ **Carrega só o id.** O valor, o status e a metadata vêm de consultar a API
 * — é decisão do provedor, e boa: nenhum dado do pagador trafega na notificação,
 * então interceptá-la não revela nada.
 *
 * `user_id` é o VENDEDOR (o músico). É por ele que descobrimos com qual token
 * consultar a cobrança.
 */
export class MercadoPagoWebhookBody {
  @IsOptional()
  @IsString()
  action?: string;

  @IsOptional()
  @IsString()
  type?: string;

  /** Chega como número no corpo do MP; tratado como string aqui. */
  @IsOptional()
  user_id?: string | number;

  @IsOptional()
  @IsObject()
  data?: { id?: string | number };
}
