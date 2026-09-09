import { ApiProperty } from "@nestjs/swagger";

import { IndicationOutput } from "../../core/indication/application/use-cases/common/indication-output";

export class IndicationPresenter {
  @ApiProperty({ format: "uuid" })
  id: string;

  /**
   * ⚠️ O id do fã sai, o NOME não. A caixa de entrada existe para o
   * estabelecimento reagir ao sinal do público, não para descobrir quem gosta
   * de quem — mesma postura do leaderboard, que só mostra apelido e avatar.
   * Enriquecer com identidade do fã é decisão de produto, não detalhe de
   * presenter.
   */
  @ApiProperty({ format: "uuid" })
  audience_id: string;

  @ApiProperty({ format: "uuid" })
  musician_id: string;

  @ApiProperty({ format: "uuid" })
  establishment_id: string;

  @ApiProperty({ nullable: true })
  message: string | null;

  @ApiProperty({ enum: ["new", "seen", "archived"] })
  status: string;

  @ApiProperty()
  is_new: boolean;

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  constructor(output: IndicationOutput) {
    this.id = output.id;
    this.audience_id = output.audience_id;
    this.musician_id = output.musician_id;
    this.establishment_id = output.establishment_id;
    this.message = output.message;
    this.status = output.status;
    this.is_new = output.is_new;
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class IndicationCollectionPresenter {
  @ApiProperty({ type: [IndicationPresenter] })
  data: IndicationPresenter[];

  @ApiProperty()
  meta: {
    total: number;
    current_page: number;
    per_page: number;
    last_page: number;
    /** Badge da caixa: quantas ainda não foram vistas. */
    new_count: number;
  };

  constructor(output: {
    items: IndicationOutput[];
    total: number;
    current_page: number;
    per_page: number;
    last_page: number;
    new_count: number;
  }) {
    this.data = output.items.map((item) => new IndicationPresenter(item));
    this.meta = {
      total: output.total,
      current_page: output.current_page,
      per_page: output.per_page,
      last_page: output.last_page,
      new_count: output.new_count,
    };
  }
}
