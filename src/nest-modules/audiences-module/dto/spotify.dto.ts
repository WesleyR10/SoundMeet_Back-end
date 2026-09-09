import { ApiProperty } from "@nestjs/swagger";
import { IsNotEmpty, IsString, MaxLength } from "class-validator";

/**
 * O DTO **não** recebe `audience_id`: ele vem do `:id` da rota, protegido pelo
 * `AudienceOwnershipGuard`. Aceitá-lo pelo corpo permitiria salvar música na
 * biblioteca de outra pessoa.
 */
export class FindSpotifyTrackDto {
  @ApiProperty({ example: "Garota de Ipanema", maxLength: 200 })
  @MaxLength(200)
  @IsString()
  @IsNotEmpty()
  title: string;

  @ApiProperty({ example: "Tom Jobim", maxLength: 200 })
  @MaxLength(200)
  @IsString()
  @IsNotEmpty()
  artist: string;
}

export class SaveSpotifyTrackDto {
  /**
   * Id da faixa **confirmada** pelo fã, devolvido pela busca.
   *
   * É `track_id`, e não título+artista, de propósito: quem resolve a
   * ambiguidade entre cover, remaster e homônimo é a busca, com confirmação
   * visual. Aceitar texto livre aqui recriaria a adivinhação no exato ponto em
   * que ela vira escrita na conta de outra pessoa.
   */
  @ApiProperty({ example: "3z8h0TU7ReDPLIbEnYhWZb", maxLength: 100 })
  @MaxLength(100)
  @IsString()
  @IsNotEmpty()
  track_id: string;
}
