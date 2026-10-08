import { IsDate, IsNotEmpty, IsString } from "class-validator";

import { ClassValidatorFields } from "../../../shared/domain/validators/class-validator-fields";
import { Notification } from "../../../shared/domain/validators/notification";
import { AudienceSpotifyLink } from "../audience-spotify-link.aggregate";

export class AudienceSpotifyLinkRules {
  @IsString()
  @IsNotEmpty()
  link_id: string;

  @IsString()
  @IsNotEmpty()
  audience_id: string;

  @IsString()
  @IsNotEmpty()
  spotify_user_id: string;

  /**
   * Os tokens são validados por PRESENÇA, nunca por formato.
   *
   * O formato é do provedor e muda sem aviso; um regex aqui recusaria um token
   * perfeitamente válido no dia em que o Spotify mudasse o encoding — e o
   * sintoma seria "ninguém mais consegue vincular". O que importa é não
   * persistir vínculo vazio, que é o estado que quebra silenciosamente na hora
   * de salvar a música.
   */
  @IsString()
  @IsNotEmpty()
  access_token: string;

  /**
   * 🔴 Obrigatório: sem ele o vínculo morre quando o access expira (~1h) e o fã
   * teria de reautorizar toda vez. A causa quase certa de vir vazio é o escopo
   * de autorização incompleto.
   */
  @IsString()
  @IsNotEmpty()
  refresh_token: string;

  @IsDate()
  expires_at: Date;

  @IsDate()
  created_at: Date;

  constructor(entity: AudienceSpotifyLink) {
    Object.assign(this, {
      link_id: entity.link_id.id,
      audience_id: entity.audience_id.id,
      spotify_user_id: entity.spotify_user_id,
      access_token: entity.access_token,
      refresh_token: entity.refresh_token,
      expires_at: entity.expires_at,
      created_at: entity.created_at,
    });
  }
}

export class AudienceSpotifyLinkValidator extends ClassValidatorFields {
  /**
   * ⚠️ `[]` quando não vêm campos, e **nunca** `Object.keys(rules)` — ver a
   * explicação completa em `BookingEscrowValidator`.
   */
  validate(
    notification: Notification,
    data: AudienceSpotifyLink,
    fields?: string[],
  ): boolean {
    const newFields = fields?.length ? fields : [];
    return super.validate(
      notification,
      new AudienceSpotifyLinkRules(data),
      newFields,
    );
  }
}

export class AudienceSpotifyLinkValidatorFactory {
  static create() {
    return new AudienceSpotifyLinkValidator();
  }
}
