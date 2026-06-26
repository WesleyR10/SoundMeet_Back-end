import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";
import {
  RepertoireInviteeOutput,
  RepertoireOutput,
  RepertoireSongOutput,
} from "../../core/repertoire/application/use-cases/common/repertoire-output";
import { PaginationOutput } from "../../core/shared/application/pagination-output";
import { CollectionPresenter } from "../shared-module/collection.presenter";

export class RepertoireSongPresenter {
  @ApiProperty({ example: "uuid-v4" })
  song_id: string;

  @ApiProperty({ example: "uuid-v4" })
  music_library_id: string;

  @ApiProperty({ example: 1 })
  position: number;

  @ApiProperty({ example: "Bohemian Rhapsody" })
  title: string;

  @ApiProperty({ example: "Queen" })
  artist: string;

  @ApiPropertyOptional({ nullable: true, example: "Capo na 2ª casa" })
  custom_notes: string | null;

  @ApiPropertyOptional({ nullable: true, example: 210 })
  duration_override_seconds: number | null;

  @ApiPropertyOptional({ nullable: true, example: 354 })
  duration_seconds: number | null;

  @ApiPropertyOptional({ nullable: true, example: 210 })
  effective_duration_seconds: number | null;

  constructor(output: RepertoireSongOutput) {
    this.song_id = output.song_id;
    this.music_library_id = output.music_library_id;
    this.position = output.position;
    this.title = output.title;
    this.artist = output.artist;
    this.custom_notes = output.custom_notes;
    this.duration_override_seconds = output.duration_override_seconds;
    this.duration_seconds = output.duration_seconds;
    this.effective_duration_seconds = output.effective_duration_seconds;
  }
}

export class RepertoireInviteePresenter {
  @ApiProperty({ example: "uuid-v4" })
  id: string;

  @ApiProperty({ example: "uuid-v4" })
  musician_id: string;

  @ApiProperty()
  invited_at: Date;

  constructor(output: RepertoireInviteeOutput) {
    this.id = output.id;
    this.musician_id = output.musician_id;
    this.invited_at = output.invited_at;
  }
}

export class RepertoirePresenter {
  @ApiProperty({ example: "uuid-v4" })
  repertoire_id: string;

  @ApiProperty({ example: "uuid-v4" })
  musician_id: string;

  @ApiProperty({ example: "Setlist Principal" })
  name: string;

  @ApiProperty({ type: [RepertoireSongPresenter] })
  songs: RepertoireSongPresenter[];

  @ApiProperty({ example: 12 })
  song_count: number;

  @ApiPropertyOptional({ nullable: true, example: 45.5 })
  estimated_show_duration_minutes: number | null;

  @ApiProperty()
  is_shared: boolean;

  @ApiPropertyOptional({ nullable: true, example: "uuid-share-token" })
  share_token: string | null;

  @ApiPropertyOptional({ nullable: true })
  share_token_expires_at: Date | null;

  @ApiProperty({ type: [RepertoireInviteePresenter] })
  invitees: RepertoireInviteePresenter[];

  @ApiProperty()
  created_at: Date;

  @ApiProperty()
  updated_at: Date;

  constructor(output: RepertoireOutput) {
    this.repertoire_id = output.repertoire_id;
    this.musician_id = output.musician_id;
    this.name = output.name;
    this.songs = output.songs.map((s) => new RepertoireSongPresenter(s));
    this.song_count = output.song_count;
    this.estimated_show_duration_minutes = output.estimated_show_duration_minutes;
    this.is_shared = output.is_shared;
    this.share_token = output.share_token;
    this.share_token_expires_at = output.share_token_expires_at;
    this.invitees = output.invitees.map((i) => new RepertoireInviteePresenter(i));
    this.created_at = output.created_at;
    this.updated_at = output.updated_at;
  }
}

export class RepertoireCollectionPresenter extends CollectionPresenter {
  @ApiProperty({ type: [RepertoirePresenter] })
  data: RepertoirePresenter[];

  constructor(output: PaginationOutput<RepertoireOutput>) {
    const { items, ...paginationProps } = output;
    super(paginationProps);
    this.data = items.map((i) => new RepertoirePresenter(i));
  }
}
