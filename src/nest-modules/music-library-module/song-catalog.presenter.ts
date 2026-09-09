import { ApiProperty } from "@nestjs/swagger";

import {
  SongCatalogEntry,
  SongCatalogScope,
} from "../../core/music-library/domain/music-library.repository";
import { SearchSongCatalogOutput } from "../../core/music-library/application/use-cases/search-song-catalog/search-song-catalog.use-case";

/**
 * Uma música do catálogo, do jeito que o fã vê.
 *
 * ⚠️ **Allowlist, nunca `...entry`.** Mesmo motivo do
 * `PublicMusicLibraryItemPresenter`: um campo novo na entrada não pode
 * atravessar sozinho. Em particular, o dono da linha nunca sai — a resposta
 * diz "a plataforma tem esta música", nunca "fulano toca esta música".
 */
export class SongCatalogItemPresenter {
  @ApiProperty()
  title: string;

  @ApiProperty()
  artist: string;

  @ApiProperty({ nullable: true })
  genre: string | null;

  @ApiProperty({
    description:
      "Quantos músicos da plataforma têm a música. Sinal de popularidade — não diz quais.",
  })
  musicians_count: number;

  @ApiProperty({
    nullable: true,
    format: "uuid",
    description:
      "A linha DESTE músico para a música, quando ele já a tem. É o que o pedido envia em library_id; nulo significa que ele ainda não tem — o pedido segue por título e artista.",
  })
  library_id: string | null;

  constructor(entry: SongCatalogEntry) {
    this.title = entry.title;
    this.artist = entry.artist;
    this.genre = entry.genre;
    this.musicians_count = entry.musicians_count;
    this.library_id = entry.library_id;
  }
}

export class SongCatalogPresenter {
  @ApiProperty({
    enum: ["platform", "repertoire"],
    description:
      "Onde a busca aconteceu. `repertoire` significa que este músico só aceita pedidos do próprio repertório — é o que a tela usa para explicar ao fã por que uma música pode não aparecer.",
  })
  scope: SongCatalogScope;

  @ApiProperty({ type: [SongCatalogItemPresenter] })
  items: SongCatalogItemPresenter[];

  constructor(output: SearchSongCatalogOutput) {
    this.scope = output.scope;
    this.items = output.items.map((item) => new SongCatalogItemPresenter(item));
  }
}
