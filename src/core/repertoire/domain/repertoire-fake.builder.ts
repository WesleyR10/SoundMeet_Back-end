import { randomUUID } from "crypto";
import { Repertoire, RepertoireId } from "./repertoire.aggregate";

export class RepertoireFakeBuilder {
  private _repertoire_id: RepertoireId = new RepertoireId();
  private _musician_id: string = randomUUID();
  private _name: string = "Setlist Principal";
  private _is_shared: boolean = false;
  private _share_token: string | null = null;
  private _share_token_expires_at: Date | null = null;
  private _created_at: Date = new Date();
  private _updated_at: Date = new Date();

  static aRepertoire(): RepertoireFakeBuilder {
    return new RepertoireFakeBuilder();
  }

  static theRepertoires(count: number): RepertoireFakeBuilder[] {
    return Array.from({ length: count }, () => new RepertoireFakeBuilder());
  }

  withRepertoireId(id: string | RepertoireId): this {
    this._repertoire_id = typeof id === "string" ? new RepertoireId(id) : id;
    return this;
  }

  withMusicianId(id: string): this {
    this._musician_id = id;
    return this;
  }

  withName(name: string): this {
    this._name = name;
    return this;
  }

  withIsShared(value: boolean): this {
    this._is_shared = value;
    return this;
  }

  withShareToken(token: string | null): this {
    this._share_token = token;
    return this;
  }

  withShareTokenExpiresAt(date: Date | null): this {
    this._share_token_expires_at = date;
    return this;
  }

  withCreatedAt(date: Date): this {
    this._created_at = date;
    return this;
  }

  withInvalidNameEmpty(): this {
    this._name = "";
    return this;
  }

  withInvalidNameTooLong(): this {
    this._name = "a".repeat(256);
    return this;
  }

  build(): Repertoire {
    return new Repertoire({
      repertoire_id: this._repertoire_id,
      musician_id: this._musician_id,
      name: this._name,
      is_shared: this._is_shared,
      share_token: this._share_token,
      share_token_expires_at: this._share_token_expires_at,
      created_at: this._created_at,
      updated_at: this._updated_at,
    });
  }
}
