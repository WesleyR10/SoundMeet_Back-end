import { BandId } from "@core/musician/domain/band.aggregate";
import { IBandRepository } from "@core/musician/domain/band.repository";
import { IPixGateway, ITipRepository, PaymentMethod, Tip } from "@core/payment";
import { splitAmountInCents } from "@core/payment/domain/split-amount";
import { PlanCheckService } from "@core/plans";
import { IUseCase } from "@core/shared/application/use-case.interface";

export type SendTipInput = {
  audience_id: string;
  musician_id?: string;
  band_id?: string;
  event_id?: string;
  amount: number;
  message?: string;
  payment_method: PaymentMethod;
  pix_key?: { key: string; type: string };
  is_anonymous?: boolean;
  show_in_wall?: boolean;
};

export type SendTipOutput = {
  id: string;
  status: string;
  /** Percentual de taxa retido pela plataforma (ex.: 8 = 8%). Baseado no plano do músico. */
  platform_fee_percentage: number;
  qr_code?: string;
  copy_paste_code?: string;
};

export class SendTipUseCase implements IUseCase<SendTipInput, SendTipOutput> {
  constructor(
    private tipRepository: ITipRepository,
    private readonly planCheckService: PlanCheckService,
    private readonly pixGateway?: IPixGateway,
    /**
     * Taxa do PROVEDOR, em % (Mercado Pago: 0,99).
     *
     * 🔴 Ela sai da comissão da plataforma, não do músico — e isso não é
     * generosidade, é a promessa da tabela de preços: "9% / 7% / 5%
     * (**1% gateway incluso**)". Ver `getApplicationFee`.
     */
    private readonly gatewayFeePercentage: number = 0,
    /**
     * Necessário para gorjeta de BANDA: banda não tem conta no provedor, então
     * a cobrança liquida na conta do líder. Ver `resolveBeneficiary`.
     */
    private readonly bandRepo?: IBandRepository,
  ) {}

  /**
   * Em que conta a gorjeta vai liquidar.
   *
   * 🔴 **Banda não tem conta no provedor de pagamento.** O vínculo (OAuth do
   * Mercado Pago) é sempre de uma PESSOA, então a gorjeta para uma banda
   * liquida na conta do **líder** — mesma decisão de `buildContracted` no
   * contrato digital ("o MEI é do líder, não da banda").
   *
   * Devolve `null` quando não há líder resolvível; o adapter então recusa com
   * um erro que a UI sabe traduzir ("este artista ainda não conectou uma
   * conta"), em vez de tentar cobrar num lugar que não existe.
   *
   * A **divisão** entre os integrantes continua sendo feita na confirmação
   * (`ConfirmTipPaymentUseCase`), sobre o registro — não no provedor.
   */
  private async resolveBeneficiary(
    input: SendTipInput,
  ): Promise<string | null> {
    if (input.musician_id) {
      return input.musician_id;
    }

    if (!input.band_id || !this.bandRepo) {
      return null;
    }

    const band = await this.bandRepo.findById(new BandId(input.band_id));
    return band?.leader?.musician_id.id ?? null;
  }

  /**
   * Quanto a plataforma pede ao provedor a título de comissão.
   *
   * ## Por que não é simplesmente o percentual do plano
   *
   * No marketplace do Mercado Pago a ordem de desconto é fixa: **a taxa do MP
   * sai do bruto primeiro**, e só depois a nossa comissão sai do restante. Ou
   * seja, quem absorveria a taxa do provedor seria o MÚSICO — ele receberia
   * 90,01% num plano que promete 91%.
   *
   * A tabela de preços diz "9% (1% gateway incluso)". Para a promessa ser
   * verdadeira, a nossa comissão tem de ser **o percentual do plano MENOS a
   * taxa do provedor**: o músico é debitado exatamente o que foi anunciado, e a
   * diferença é o custo que já estava embutido.
   *
   * Num plano com percentual **abaixo** da taxa do gateway a conta ficaria
   * negativa — impossível hoje (o menor é 5% contra 0,99%), mas o piso em zero
   * evita que uma mudança futura de tabela vire um `application_fee` negativo
   * que o provedor recusa.
   */
  private getApplicationFee(amount: number, planPercentage: number): number {
    const netPercentage = Math.max(
      planPercentage - this.gatewayFeePercentage,
      0,
    );
    return splitAmountInCents(amount, netPercentage).platform_fee.amount;
  }

  async execute(input: SendTipInput): Promise<SendTipOutput> {
    const platform_fee_percentage = input.musician_id
      ? await this.planCheckService.getMusicianTipFeePercentage(
          input.musician_id,
        )
      : 8; // taxa padrão quando músico não identificado

    const tip = Tip.create({
      audience_id: input.audience_id,
      musician_id: input.musician_id,
      band_id: input.band_id,
      event_id: input.event_id,
      amount: input.amount,
      message: input.message,
      payment_method: input.payment_method,
      pix_key: input.pix_key,
      is_anonymous: input.is_anonymous,
      show_in_wall: input.show_in_wall,
    });

    await this.tipRepository.insert(tip);

    let qr_code, copy_paste_code;
    if (input.payment_method === PaymentMethod.PIX) {
      if (this.pixGateway) {
        /*
         * Em CENTAVOS INTEIROS, e não `amount * pct / 100` solto: em ponto
         * flutuante 9% de R$333,33 dá 29,999700000000004, e o provedor recusa
         * (ou aceita com um centavo errado). Mesma armadilha que o `Money` já
         * barra no domínio.
         */
        const applicationFee = this.getApplicationFee(
          input.amount,
          platform_fee_percentage,
        );
        const beneficiaryMusicianId = await this.resolveBeneficiary(input);

        const res = await this.pixGateway.generatePayment({
          amount: input.amount,
          /*
           * 🔴 O beneficiário é obrigatório no adapter real: a cobrança é criada
           * na conta DELE, e a comissão sai por `application_fee`. Sem isso o
           * dinheiro cairia na conta da plataforma — custódia de recurso de
           * terceiro, que a arquitetura recusa.
           *
           * Em gorjeta de banda, é o LÍDER (ver `resolveBeneficiary`).
           */
          beneficiary_musician_id: beneficiaryMusicianId,
          platform_fee: applicationFee,
          metadata: {
            musician_id: input.musician_id,
            band_id: input.band_id,
            tip_id: tip.tip_id.id,
          },
        });
        qr_code = res.qr_code;
        copy_paste_code = res.copy_paste_code;

        /*
         * Guarda o payload da cobrança.
         *
         * A ordem continua sendo inserir → cobrar → atualizar, e não
         * cobrar → inserir: falha do provedor deixa uma gorjeta `pending` sem
         * payload, que ninguém paga e nada quebra. A ordem inversa deixaria
         * uma cobrança viva no provedor apontando (via `external_reference`)
         * para uma gorjeta que não existe — e o webhook não teria o que
         * confirmar.
         */
        tip.attachPixCharge(res.qr_code, res.copy_paste_code);
        await this.tipRepository.update(tip);
      } else {
        qr_code = "mock_qr_code_base64";
        copy_paste_code = "mock_copy_paste_code";
      }
    }

    return {
      id: tip.tip_id.id,
      status: tip.status,
      platform_fee_percentage,
      qr_code,
      copy_paste_code,
    };
  }
}
