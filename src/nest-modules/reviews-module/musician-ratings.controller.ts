import {
  Body,
  Controller,
  Get,
  Inject,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";

import { ListReviewsUseCase } from "../../core/review/application/use-cases/list-reviews/list-reviews.use-case";
import { SubmitReviewUseCase } from "../../core/review/application/use-cases/submit-review/submit-review.use-case";
import {
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  Public,
  Roles,
  RolesGuard,
} from "../auth-module";
import { AuthenticatedUser } from "../auth-module/interfaces/authenticated-user.interface";
import { SearchReviewsDto } from "./dto/search-reviews.dto";
import { SubmitReviewDto } from "./dto/submit-review.dto";
import {
  ReviewCollectionPresenter,
  SubmitReviewPresenter,
} from "./review.presenter";
import { resolveReviewAuthor } from "./review-author.resolver";

@ApiTags("Reviews")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("musicians")
export class MusicianRatingsController {
  @Inject(SubmitReviewUseCase)
  private submitUseCase: SubmitReviewUseCase;

  @Inject(ListReviewsUseCase)
  private listUseCase: ListReviewsUseCase;

  @Post(":id/ratings")
  @Roles("audience", "establishment", "admin")
  @ApiOperation({
    summary: "Avaliar um músico",
    description:
      "Registra a avaliação no ledger e recalcula a média do perfil. Exige PROVA DE VÍNCULO: o público precisa ter estado no evento em que o músico se apresentou (context_type=event); o estabelecimento precisa de um show concluído com ele (context_type=booking). Avaliar de novo o mesmo contexto ATUALIZA a nota, não soma outra.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: SubmitReviewPresenter })
  @ApiResponse({
    status: 403,
    description: "Sem vínculo comprovado com o alvo",
  })
  @ApiResponse({ status: 404, description: "Músico não encontrado" })
  @ApiResponse({ status: 422, description: "Nota fora de 1..5" })
  async submit(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: SubmitReviewDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const author = resolveReviewAuthor({
      user,
      context_type: dto.context_type,
      // Quem avalia um MÚSICO por reserva é o estabelecimento contratante.
      bookingAuthorType: "establishment",
      author_establishment_id: dto.author_establishment_id,
    });

    const output = await this.submitUseCase.execute({
      target_type: "musician",
      target_id: id,
      rating: dto.rating,
      comment: dto.comment,
      context_type: dto.context_type,
      context_id: dto.context_id,
      ...author,
    });

    return new SubmitReviewPresenter(output);
  }

  @Get(":id/ratings")
  @Public()
  @ApiOperation({
    summary: "Avaliações recebidas por um músico",
    description:
      "Público: a nota e os comentários são o que sustenta a decisão de contratar. Não expõe nada além do que já está no perfil.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: ReviewCollectionPresenter })
  async list(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Query() query: SearchReviewsDto,
  ) {
    const output = await this.listUseCase.execute({
      ...query,
      target_type: "musician",
      target_id: id,
    });
    return new ReviewCollectionPresenter(output);
  }
}
