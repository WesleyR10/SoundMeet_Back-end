import {
  IsEnum,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from "class-validator";

import {
  SOCIAL_SHARE_CONTENT_TYPES,
  SocialShareContentType,
} from "../../../domain/value-objects/social-share-content";

export enum SocialMediaPlatform {
  FACEBOOK = "facebook",
  INSTAGRAM = "instagram",
  TWITTER = "twitter",
  WHATSAPP = "whatsapp",
  TELEGRAM = "telegram",
}

export class ShareSocialMediaInput {
  @IsString()
  @IsNotEmpty()
  @IsUUID()
  audience_id: string;

  /**
   * 🔴 Substituiu `request_id` em 28/set/2026. O par (tipo, id) identifica a
   * PEÇA compartilhada, que é o que permite creditar uma vez por conteúdo em
   * vez de uma vez por toque — ver `social-share-content.ts`.
   *
   * A rota não tinha nenhum cliente (o app compartilhava sem nunca chamá-la),
   * então a troca de contrato não quebra ninguém.
   */
  @IsIn(SOCIAL_SHARE_CONTENT_TYPES as unknown as string[])
  @IsNotEmpty()
  content_type: SocialShareContentType;

  @IsString()
  @IsNotEmpty()
  @IsUUID()
  content_id: string;

  /**
   * 🔴 OPCIONAL desde 28/set/2026, porque o app genuinamente NÃO SABE.
   *
   * O share sheet do sistema operacional não informa o destino escolhido —
   * `imageShare.ts` registra que nem sequer distingue "compartilhou" de
   * "cancelou". Exigir a plataforma obrigaria o cliente a inventar um valor,
   * e um dado inventado é pior que um dado ausente: ele entra em relatório
   * como se fosse verdade.
   *
   * Continua aceito para os fluxos em que o destino É conhecido (um botão
   * "compartilhar no WhatsApp" específico, por exemplo).
   */
  @IsEnum(SocialMediaPlatform)
  @IsOptional()
  platform?: SocialMediaPlatform;

  @IsString()
  @MaxLength(500)
  @IsOptional()
  message?: string;
}
