import { ForbiddenException } from "@nestjs/common";

import {
  ReviewAuthorType,
  ReviewContextType,
} from "../../core/review/domain/review-types";
import { AuthenticatedUser } from "../auth-module/interfaces/authenticated-user.interface";

export type ResolvedAuthor = {
  author_type: ReviewAuthorType;
  author_id: string;
};

/**
 * Deriva o autor da avaliação do JWT — nunca do corpo da requisição.
 *
 * Aceitar `author_id` do cliente permitiria avaliar em nome de terceiros, que
 * é o caminho mais barato para inflar (ou destruir) a nota de um perfil.
 *
 * O tipo de autor é decidido pelo **contexto**, não pelo papel: quem prova
 * presença num evento está avaliando como público; quem prova um show
 * concluído está avaliando como a parte contratante/contratada daquele show.
 *
 * ⚠️ Assimetria que não pode ser esquecida: para músico e público
 * `aggregate_id === sub`, então o `author_id` é o próprio `userId`. Para
 * estabelecimento **não** — o id vem do claim `establishment_ids`, e uma conta
 * pode operar até 3 unidades (Bloco 9.1).
 */
export function resolveReviewAuthor(params: {
  user: AuthenticatedUser;
  context_type: ReviewContextType;
  /** Qual estabelecimento assina, quando a conta opera mais de um. */
  author_establishment_id?: string | null;
  /** Papel esperado quando o contexto é um booking. */
  bookingAuthorType: Extract<ReviewAuthorType, "musician" | "establishment">;
}): ResolvedAuthor {
  const { user, context_type, bookingAuthorType } = params;

  if (context_type === "event") {
    if (!user.roles.includes("audience") && !user.isAdmin) {
      throw new ForbiddenException(
        "Avaliação por evento é do público — entre com sua conta de fã.",
      );
    }
    return { author_type: "audience", author_id: user.userId };
  }

  if (bookingAuthorType === "musician") {
    if (!user.roles.includes("musician") && !user.isAdmin) {
      throw new ForbiddenException(
        "Avaliação por reserva é do músico contratado.",
      );
    }
    // Musician.id === sub (invariante do Bloco 4E).
    return { author_type: "musician", author_id: user.userId };
  }

  return {
    author_type: "establishment",
    author_id: resolveEstablishmentAuthorId(
      user,
      params.author_establishment_id,
    ),
  };
}

function resolveEstablishmentAuthorId(
  user: AuthenticatedUser,
  requested?: string | null,
): string {
  const owned = user.establishmentIds ?? [];

  if (requested) {
    // O id vem do cliente, mas só é aceito se o TOKEN comprovar a posse.
    if (!owned.includes(requested) && !user.isAdmin) {
      throw new ForbiddenException("Você não opera este estabelecimento.");
    }
    return requested;
  }

  if (owned.length === 1) {
    return owned[0];
  }

  if (owned.length === 0) {
    throw new ForbiddenException(
      "Nenhum estabelecimento vinculado à sua conta. Se acabou de criar, atualize o token.",
    );
  }

  // Multi-estabelecimento (até 3, plano PRO): adivinhar qual assina a
  // avaliação seria escolher errado em silêncio.
  throw new ForbiddenException(
    "Sua conta opera mais de um estabelecimento — informe author_establishment_id.",
  );
}
