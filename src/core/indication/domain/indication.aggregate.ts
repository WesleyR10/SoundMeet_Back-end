import { AggregateRoot, Uuid } from "../../shared/domain";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { IndicationValidatorFactory } from "./indication.validator";
import { IndicationFakeBuilder } from "./indication-fake.builder";
import { IndicationStatus } from "./indication-types";

export * from "./indication-types";

export type IndicationConstructorProps = {
  indication_id?: IndicationId;
  audience_id: string;
  musician_id: string;
  establishment_id: string;
  message?: string | null;
  status?: IndicationStatus;
  created_at?: Date;
  updated_at?: Date;
};

export type IndicationCreateCommand = {
  audience_id: string;
  musician_id: string;
  establishment_id: string;
  message?: string | null;
};

export class IndicationId extends Uuid {}

/**
 * Indicação de um músico, por um fã, para um estabelecimento.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * POR QUE ESTE AGREGADO EXISTE
 * ════════════════════════════════════════════════════════════════════════════
 *
 * `IndicateMusicianUseCase` existia desde sempre e **descartava a indicação**:
 * incrementava os pontos do fã e emitia `MusicianIndicatedEvent`, que nenhum
 * handler escutava. Quem indicou quem, para onde e por quê nunca era gravado —
 * e é por isso que a caixa de indicações do estabelecimento nunca pôde ser
 * construída. Não faltava tela; faltava dado.
 *
 * O ciclo B2B do produto depende disto: *"seu público indicou 4 músicos essa
 * semana"* é um e-mail de aquisição que só o SoundMeet consegue mandar, porque
 * só ele tem os dois lados.
 *
 * ⚠️ **`status` pertence a quem RECEBE.** O fã indica e sai de cena; marcar
 * como vista ou arquivar é ação do estabelecimento. Por isso não há método que
 * o fã possa chamar para mexer nele.
 *
 * ⚠️ **Unicidade por (fã, músico, estabelecimento), garantida no banco.** O
 * mesmo fã indicando o mesmo músico para a mesma casa de novo é a mesma
 * opinião, repetida — não uma indicação nova. A checagem também existe no
 * use-case, mas dois POSTs simultâneos furam qualquer verificação feita só na
 * aplicação; quem decide é o índice único.
 */
export class Indication extends AggregateRoot {
  indication_id: IndicationId;
  audience_id: string;
  musician_id: string;
  establishment_id: string;
  message: string | null;
  status: IndicationStatus;
  created_at: Date;
  updated_at: Date;

  constructor(props: IndicationConstructorProps) {
    super();
    this.indication_id = props.indication_id ?? new IndicationId();
    this.audience_id = props.audience_id;
    this.musician_id = props.musician_id;
    this.establishment_id = props.establishment_id;
    this.message = props.message ?? null;
    this.status = props.status ?? "new";
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): IndicationId {
    return this.indication_id;
  }

  static create(command: IndicationCreateCommand): Indication {
    const indication = new Indication({
      audience_id: command.audience_id,
      musician_id: command.musician_id,
      establishment_id: command.establishment_id,
      message: command.message ?? null,
    });

    indication.validate();

    if (indication.notification.hasErrors()) {
      throw new EntityValidationError(indication.notification.toJSON());
    }

    return indication;
  }

  validate(fields?: string[]): void {
    const validator = IndicationValidatorFactory.create();
    validator.validate(this.notification, this, fields);
  }

  /** Ação do estabelecimento: já olhei esta indicação. */
  markAsSeen(): void {
    if (this.status === "archived") return;
    this.status = "seen";
    this.updated_at = new Date();
  }

  /**
   * Ação do estabelecimento: tirar da caixa de entrada.
   *
   * Arquivar não apaga: a indicação continua contando como sinal do público
   * (e como ponto já creditado ao fã). Some da lista, não da história.
   */
  archive(): void {
    this.status = "archived";
    this.updated_at = new Date();
  }

  static fake(): typeof IndicationFakeBuilder {
    return IndicationFakeBuilder;
  }

  toJSON() {
    return {
      indication_id: this.indication_id.id,
      audience_id: this.audience_id,
      musician_id: this.musician_id,
      establishment_id: this.establishment_id,
      message: this.message,
      status: this.status,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
