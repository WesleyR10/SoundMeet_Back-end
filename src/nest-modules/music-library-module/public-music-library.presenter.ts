import { ApiProperty } from "@nestjs/swagger";

import { MusicLibraryOutput } from "../../core/music-library/application/use-cases/common/music-library-output";
import { PaginationOutput } from "../../core/shared/application/pagination-output";
import { CollectionPresenter } from "../shared-module/collection.presenter";

/**
 * Repertório do músico visto por quem NÃO é o dono (Bloco 9.6c).
 *
 * ⚠️ **Allowlist, nunca omissão.** Os campos são copiados um a um de propósito:
 * `chords`, `chord_sheet`, `renderable_chord_sheet`, `lyrics` e `notes` não
 * podem sair daqui, e um `...output` com `delete` deixaria a rota vazar
 * qualquer campo novo que o dia de amanhã adicionar ao output.
 *
 * O que sai é só o suficiente para **identificar a música** na hora de pedir —
 * mesma filosofia da busca que o músico já usa (`GET .../ai-cifra/search`).
 * Conteúdo de cifra e letra tem risco de licenciamento, e é justamente o que o
 * kill-switch da comunidade de cifras existe para conter.
 *
 * `notes` é anotação **privada** do músico sobre a música — nunca de terceiros.
 */
export class PublicMusicLibraryItemPresenter {
  @ApiProperty({ format: "uuid" })
  id: string;

  @ApiProperty({ format: "uuid" })
  musician_id: string;

  @ApiProperty()
  title: string;

  @ApiProperty()
  artist: string;

  @ApiProperty({ nullable: true })
  genre: string | null;

  @ApiProperty({
    description: "1 a 5 — ajuda o fã a calibrar o pedido, não revela a cifra.",
  })
  difficulty: number;

  @ApiProperty({
    nullable: true,
    description:
      "Duração em segundos, quando o pipeline já preencheu. Não expõe nada da cifra.",
  })
  duration_seconds: number | null;

  constructor(output: MusicLibraryOutput) {
    this.id = output.id;
    this.musician_id = output.musician_id;
    this.title = output.title;
    this.artist = output.artist;
    this.genre = output.genre;
    this.difficulty = output.difficulty;
    this.duration_seconds =
      (output as { duration_seconds?: number | null }).duration_seconds ?? null;
  }
}

export class PublicMusicLibraryCollectionPresenter extends CollectionPresenter {
  @ApiProperty({ type: [PublicMusicLibraryItemPresenter] })
  data: PublicMusicLibraryItemPresenter[];

  constructor(output: PaginationOutput<MusicLibraryOutput>) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new PublicMusicLibraryItemPresenter(i));
  }
}
