import { randomUUID } from "crypto";
import { AggregateRoot, Uuid } from "../../shared/domain";
import { EntityValidationError } from "../../shared/domain/validators/validation.error";
import { RepertoireValidatorFactory } from "./repertoire.validator";
import { RepertoireFakeBuilder } from "./repertoire-fake.builder";

// ─── Embedded entity ────────────────────────────────────────────────────────

export type RepertoireSongProps = {
  song_id: string;
  music_library_id: string;
  position: number;
  custom_notes?: string | null;
  duration_override_seconds?: number | null;
  added_at?: Date;
};

export class RepertoireSong {
  readonly song_id: string;
  readonly music_library_id: string;
  position: number;
  custom_notes: string | null;
  duration_override_seconds: number | null;
  readonly added_at: Date;

  constructor(props: RepertoireSongProps) {
    this.song_id = props.song_id;
    this.music_library_id = props.music_library_id;
    this.position = props.position;
    this.custom_notes = props.custom_notes ?? null;
    this.duration_override_seconds = props.duration_override_seconds ?? null;
    this.added_at = props.added_at ?? new Date();
  }

  /** position é opcional aqui — o aggregate atribui ao chamar addSong. */
  static create(props: Omit<RepertoireSongProps, "song_id" | "position"> & { position?: number }): RepertoireSong {
    return new RepertoireSong({ ...props, song_id: randomUUID(), position: props.position ?? 0 });
  }

  /** Duração efetiva: override se definido, caso contrário duração da biblioteca. */
  effectiveDuration(libraryDuration?: number | null): number | null {
    return this.duration_override_seconds ?? libraryDuration ?? null;
  }

  toJSON() {
    return {
      song_id: this.song_id,
      music_library_id: this.music_library_id,
      position: this.position,
      custom_notes: this.custom_notes,
      duration_override_seconds: this.duration_override_seconds,
      added_at: this.added_at,
    };
  }
}

// ─── Invitee ─────────────────────────────────────────────────────────────────

export type RepertoireInviteeProps = {
  id: string;
  musician_id: string;
  invited_at?: Date;
};

export class RepertoireInvitee {
  readonly id: string;
  readonly musician_id: string;
  readonly invited_at: Date;

  constructor(props: RepertoireInviteeProps) {
    this.id = props.id;
    this.musician_id = props.musician_id;
    this.invited_at = props.invited_at ?? new Date();
  }

  static create(musician_id: string): RepertoireInvitee {
    return new RepertoireInvitee({ id: randomUUID(), musician_id });
  }

  toJSON() {
    return { id: this.id, musician_id: this.musician_id, invited_at: this.invited_at };
  }
}

// ─── Aggregate ───────────────────────────────────────────────────────────────

export type RepertoireConstructorProps = {
  repertoire_id?: RepertoireId;
  musician_id: string;
  name: string;
  songs?: RepertoireSong[];
  invitees?: RepertoireInvitee[];
  share_token?: string | null;
  share_token_expires_at?: Date | null;
  is_shared?: boolean;
  created_at?: Date;
  updated_at?: Date;
};

export type RepertoireCreateCommand = {
  musician_id: string;
  name: string;
};

export class RepertoireId extends Uuid {}

export class Repertoire extends AggregateRoot {
  repertoire_id: RepertoireId;
  musician_id: string;
  name: string;
  songs: RepertoireSong[];
  invitees: RepertoireInvitee[];
  share_token: string | null;
  share_token_expires_at: Date | null;
  is_shared: boolean;
  created_at: Date;
  updated_at: Date;

  constructor(props: RepertoireConstructorProps) {
    super();
    this.repertoire_id = props.repertoire_id ?? new RepertoireId();
    this.musician_id = props.musician_id;
    this.name = props.name;
    this.songs = props.songs ? [...props.songs].sort((a, b) => a.position - b.position) : [];
    this.invitees = props.invitees ?? [];
    this.share_token = props.share_token ?? null;
    this.share_token_expires_at = props.share_token_expires_at ?? null;
    this.is_shared = props.is_shared ?? false;
    this.created_at = props.created_at ?? new Date();
    this.updated_at = props.updated_at ?? new Date();
  }

  get entity_id(): RepertoireId {
    return this.repertoire_id;
  }

  static create(command: RepertoireCreateCommand): Repertoire {
    const repertoire = new Repertoire({
      musician_id: command.musician_id,
      name: command.name,
    });
    repertoire.validate();
    if (repertoire.notification.hasErrors()) {
      throw new EntityValidationError(repertoire.notification.toJSON());
    }
    return repertoire;
  }

  // ─── Mutations ─────────────────────────────────────────────────────────────

  rename(name: string): void {
    this.name = name;
    this.validate(["name"]);
    if (this.notification.hasErrors()) {
      throw new EntityValidationError(this.notification.toJSON());
    }
    this.touch();
  }

  addSong(song: RepertoireSong): void {
    if (this.songs.some((s) => s.music_library_id === song.music_library_id)) {
      throw new EntityValidationError([
        { music_library_id: ["Música já está neste repertório."] },
      ]);
    }
    song.position = this.songs.length + 1;
    this.songs.push(song);
    this.touch();
  }

  removeSong(song_id: string): void {
    const index = this.songs.findIndex((s) => s.song_id === song_id);
    if (index === -1) {
      throw new EntityValidationError([
        { song_id: ["Música não encontrada neste repertório."] },
      ]);
    }
    this.songs.splice(index, 1);
    this.recomputePositions();
    this.touch();
  }

  /**
   * Reordena as músicas conforme o array de song_ids fornecido.
   * O array deve conter exatamente os IDs de todas as músicas atuais.
   */
  reorderSongs(ordered_song_ids: string[]): void {
    const current = new Set(this.songs.map((s) => s.song_id));
    const provided = new Set(ordered_song_ids);

    if (current.size !== provided.size || ![...current].every((id) => provided.has(id))) {
      throw new EntityValidationError([
        { ordered_song_ids: ["O array deve conter exatamente os IDs de todas as músicas do repertório."] },
      ]);
    }

    this.songs = ordered_song_ids.map((id, idx) => {
      const song = this.songs.find((s) => s.song_id === id)!;
      song.position = idx + 1;
      return song;
    });
    this.touch();
  }

  updateSong(song_id: string, props: { custom_notes?: string | null; duration_override_seconds?: number | null }): void {
    const song = this.songs.find((s) => s.song_id === song_id);
    if (!song) {
      throw new EntityValidationError([{ song_id: ["Música não encontrada neste repertório."] }]);
    }
    if (props.custom_notes !== undefined) {
      song.custom_notes = props.custom_notes;
    }
    if (props.duration_override_seconds !== undefined) {
      song.duration_override_seconds = props.duration_override_seconds;
    }
    this.touch();
  }

  // ─── Sharing ───────────────────────────────────────────────────────────────

  /** Gera token de compartilhamento com 7 dias de expiração. */
  share(): void {
    this.share_token = randomUUID();
    const expires = new Date();
    expires.setDate(expires.getDate() + 7);
    this.share_token_expires_at = expires;
    this.is_shared = true;
    this.touch();
  }

  unshare(): void {
    this.share_token = null;
    this.share_token_expires_at = null;
    this.is_shared = false;
    this.touch();
  }

  isShareTokenValid(): boolean {
    if (!this.is_shared || !this.share_token) return false;
    if (!this.share_token_expires_at) return false;
    return this.share_token_expires_at > new Date();
  }

  // ─── Nominal invites (PRO) ─────────────────────────────────────────────────

  inviteMusician(musician_id: string): void {
    if (musician_id === this.musician_id) {
      throw new EntityValidationError([
        { musician_id: ["O dono do repertório não pode ser convidado."] },
      ]);
    }
    if (this.invitees.some((i) => i.musician_id === musician_id)) {
      throw new EntityValidationError([
        { musician_id: ["Músico já foi convidado para este repertório."] },
      ]);
    }
    this.invitees.push(RepertoireInvitee.create(musician_id));
    this.touch();
  }

  revokeInvite(invitee_id: string): void {
    const index = this.invitees.findIndex((i) => i.id === invitee_id);
    if (index === -1) {
      throw new EntityValidationError([
        { invitee_id: ["Convite não encontrado."] },
      ]);
    }
    this.invitees.splice(index, 1);
    this.touch();
  }

  // ─── Computed ──────────────────────────────────────────────────────────────

  /**
   * Duração estimada do show em minutos.
   * Retorna null se qualquer música não tiver duração disponível.
   * libraryDurations: mapa de music_library_id → duration_seconds (do pipeline futuro).
   */
  getEstimatedShowDuration(libraryDurations: Map<string, number | null> = new Map()): number | null {
    if (this.songs.length === 0) return null;

    let totalSeconds = 0;
    for (const song of this.songs) {
      const libDuration = libraryDurations.get(song.music_library_id) ?? null;
      const effective = song.effectiveDuration(libDuration);
      if (effective === null) return null;
      totalSeconds += effective;
    }
    return Math.round((totalSeconds / 60) * 100) / 100;
  }

  // ─── Private ───────────────────────────────────────────────────────────────

  private recomputePositions(): void {
    this.songs.forEach((s, idx) => {
      s.position = idx + 1;
    });
  }

  private touch(): void {
    this.updated_at = new Date();
  }

  validate(fields?: string[]): void {
    const validator = RepertoireValidatorFactory.create();
    validator.validate(this.notification, this, fields);
  }

  static fake(): typeof RepertoireFakeBuilder {
    return RepertoireFakeBuilder;
  }

  toJSON() {
    return {
      repertoire_id: this.repertoire_id.id,
      musician_id: this.musician_id,
      name: this.name,
      songs: this.songs.map((s) => s.toJSON()),
      invitees: this.invitees.map((i) => i.toJSON()),
      share_token: this.share_token,
      share_token_expires_at: this.share_token_expires_at,
      is_shared: this.is_shared,
      created_at: this.created_at,
      updated_at: this.updated_at,
    };
  }
}
