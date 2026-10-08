import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Inject,
  Param,
  ParseUUIDPipe,
  Patch,
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

import { AcceptBandInviteUseCase } from "../../core/musician/application/use-cases/accept-band-invite/accept-band-invite.use-case";
import { BandOutput } from "../../core/musician/application/use-cases/common/band-output";
import { CreateBandInput } from "../../core/musician/application/use-cases/create-band/create-band.input";
import { CreateBandUseCase } from "../../core/musician/application/use-cases/create-band/create-band.use-case";
import { DeclineBandInviteUseCase } from "../../core/musician/application/use-cases/decline-band-invite/decline-band-invite.use-case";
import { DissolveBandInput } from "../../core/musician/application/use-cases/dissolve-band/dissolve-band.input";
import { DissolveBandUseCase } from "../../core/musician/application/use-cases/dissolve-band/dissolve-band.use-case";
import { GetBandUseCase } from "../../core/musician/application/use-cases/get-band/get-band.use-case";
import { InviteBandMemberInput } from "../../core/musician/application/use-cases/invite-band-member/invite-band-member.input";
import { InviteBandMemberUseCase } from "../../core/musician/application/use-cases/invite-band-member/invite-band-member.use-case";
import { ListBandIdentitiesUseCase } from "../../core/musician/application/use-cases/list-band-identities/list-band-identities.use-case";
import { ListBandsUseCase } from "../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import { ListMyBandsUseCase } from "../../core/musician/application/use-cases/list-my-bands/list-my-bands.use-case";
import { RemoveBandMemberInput } from "../../core/musician/application/use-cases/remove-band-member/remove-band-member.input";
import { RemoveBandMemberUseCase } from "../../core/musician/application/use-cases/remove-band-member/remove-band-member.use-case";
import { SetBandOpenToGigsInput } from "../../core/musician/application/use-cases/set-band-open-to-gigs/set-band-open-to-gigs.input";
import { SetBandOpenToGigsUseCase } from "../../core/musician/application/use-cases/set-band-open-to-gigs/set-band-open-to-gigs.use-case";
import { TransferBandLeadershipInput } from "../../core/musician/application/use-cases/transfer-band-leadership/transfer-band-leadership.input";
import { TransferBandLeadershipUseCase } from "../../core/musician/application/use-cases/transfer-band-leadership/transfer-band-leadership.use-case";
import { UpdateBandInput } from "../../core/musician/application/use-cases/update-band/update-band.input";
import { UpdateBandUseCase } from "../../core/musician/application/use-cases/update-band/update-band.use-case";
import {
  AuthenticatedUser,
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  Public,
  Roles,
  RolesGuard,
} from "../auth-module";
import { RejectedTokenSub } from "../auth-module/decorators/rejected-token-sub.decorator";
import {
  BandCollectionPresenter,
  BandIdentityPresenter,
  BandPresenter,
  DissolveBandPresenter,
  presentMyBand,
  PublicBandPresenter,
} from "./band.presenter";
import { CreateBandDto } from "./dto/create-band.dto";
import { InviteBandMemberDto } from "./dto/invite-band-member.dto";
import { ListBandIdentitiesDto } from "./dto/list-band-identities.dto";
import { SearchBandsDto } from "./dto/search-bands.dto";
import { SetBandOpenToGigsDto } from "./dto/set-band-open-to-gigs.dto";
import { TransferBandLeadershipDto } from "./dto/transfer-band-leadership.dto";
import { UpdateBandDto } from "./dto/update-band.dto";

/**
 * Rotas de banda.
 *
 * ════════════════════════════════════════════════════════════════════════════
 * 🔴 NENHUMA ROTA DAQUI USA OWNERSHIP GUARD, E É DE PROPÓSITO
 * ════════════════════════════════════════════════════════════════════════════
 *
 * Quem pode alterar a banda é o LÍDER ATUAL, e isso é lido do banco dentro de
 * cada use-case (`assertBandLeader`). Até out/2026 as escritas eram guardadas
 * pelo `BandOwnershipGuard`, que conferia o claim `band_ids` do JWT — escrito
 * só na criação da banda e nunca atualizado. Depois de uma transferência de
 * liderança, a nova líder levava 403 em tudo e o ex-líder continuava podendo
 * apagar a banda.
 *
 * O controller só entrega ao use-case QUEM está pedindo (`actorOf`), sempre a
 * partir do token.
 */
@ApiTags("Bands")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("bands")
export class BandsController {
  @Inject(CreateBandUseCase)
  private createBandUseCase: CreateBandUseCase;

  @Inject(UpdateBandUseCase)
  private updateBandUseCase: UpdateBandUseCase;

  @Inject(DissolveBandUseCase)
  private dissolveBandUseCase: DissolveBandUseCase;

  @Inject(GetBandUseCase)
  private getBandUseCase: GetBandUseCase;

  @Inject(ListBandsUseCase)
  private listBandsUseCase: ListBandsUseCase;

  @Inject(ListMyBandsUseCase)
  private listMyBandsUseCase: ListMyBandsUseCase;

  @Inject(ListBandIdentitiesUseCase)
  private listBandIdentitiesUseCase: ListBandIdentitiesUseCase;

  @Inject(InviteBandMemberUseCase)
  private inviteBandMemberUseCase: InviteBandMemberUseCase;

  @Inject(RemoveBandMemberUseCase)
  private removeBandMemberUseCase: RemoveBandMemberUseCase;

  @Inject(AcceptBandInviteUseCase)
  private acceptBandInviteUseCase: AcceptBandInviteUseCase;

  @Inject(DeclineBandInviteUseCase)
  private declineBandInviteUseCase: DeclineBandInviteUseCase;

  @Inject(SetBandOpenToGigsUseCase)
  private setBandOpenToGigsUseCase: SetBandOpenToGigsUseCase;

  @Inject(TransferBandLeadershipUseCase)
  private transferBandLeadershipUseCase: TransferBandLeadershipUseCase;

  /*
   * Só `musician`. Com `admin` na lista, um admin criava uma banda liderada
   * pelo próprio `sub` — que não é músico, não existe em `musicians` e
   * derrubava o insert na FK de `band_members`.
   */
  @Post()
  @Roles("musician")
  @ApiOperation({
    summary: "Criar banda",
    description:
      "Cria uma banda. O músico autenticado é automaticamente adicionado como líder. Os demais integrantes entram por convite (`POST /bands/:id/members`).",
  })
  @ApiResponse({ status: 201, type: BandPresenter })
  async create(
    @Body() dto: CreateBandDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const output = await this.createBandUseCase.execute(
      new CreateBandInput({
        name: dto.name,
        description: dto.description,
        genres: dto.genres,
        formed_in: dto.formed_in,
        priceRange: dto.priceRange,
        address: dto.address,
        open_to_gigs: dto.open_to_gigs,
        creator_musician_id: currentUser.userId,
      }),
    );
    return BandsController.serialize(output);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: "Buscar bandas",
    description:
      "Descoberta por quem contrata: só bandas ativas que o líder colocou no radar (`open_to_gigs`). Devolve a visão pública — cidade e estado, integrantes aceitos.",
  })
  @ApiResponse({ status: 200, type: BandCollectionPresenter })
  async findAll(@Query() query: SearchBandsDto) {
    const output = await this.listBandsUseCase.execute(query);
    return new BandCollectionPresenter(output);
  }

  /*
   * 🔴 ANTES de `@Get(":id")`, e isto NÃO é preferência de estilo.
   *
   * Depois dele, "mine" casaria como `:id`, o `ParseUUIDPipe` responderia 422
   * e "Minhas bandas" deixaria de carregar — sem erro de compilação e com este
   * handler correto logo abaixo. Mesmo defeito que `featured` teria em
   * `MusiciansController` e que `live` teve em `PerformanceController`.
   */
  @Get("mine")
  @Roles("musician")
  @ApiOperation({
    summary: "Minhas bandas",
    description:
      "As bandas que o músico autenticado integra e os convites que ainda não respondeu. O id vem do token. Banda integrada sai na visão de integrante; convite pendente, na visão pública mais a própria linha (`status: pending`).",
  })
  @ApiResponse({ status: 200, type: [BandPresenter] })
  async findMine(@CurrentUser() currentUser: AuthenticatedUser) {
    const output = await this.listMyBandsUseCase.execute({
      musician_id: currentUser.userId,
    });
    return output.items.map((item) => presentMyBand(item, currentUser.userId));
  }

  /*
   * 🔴 Também ANTES de `@Get(":id")` — mesma razão de `mine` acima.
   */
  @Get("identities")
  @Public()
  @ApiOperation({
    summary: "Identidade de várias bandas",
    description:
      "Nome, foto, gêneros e instrumentos de até 50 bandas numa chamada (`?ids=a,b,c`). Existe para as listas que guardam só o id (line-up, contratações, conversas) não fazerem um `GET /bands/:id` por banda. Não é descoberta: só resolve ids que o chamador já tem, e por isso não passa pelo gate de `open_to_gigs`. Id inexistente não volta.",
  })
  @ApiResponse({ status: 200, type: [BandIdentityPresenter] })
  async findIdentities(@Query() query: ListBandIdentitiesDto) {
    const output = await this.listBandIdentitiesUseCase.execute({
      ids: query.ids,
    });
    return output.items.map((item) => new BandIdentityPresenter(item));
  }

  @Get(":id")
  @Public()
  @ApiOperation({
    summary: "Buscar banda por ID",
    description:
      "Integrante aceito ou admin recebem a banda por dentro (endereço completo, convites em aberto); qualquer outro chamador, autenticado ou anônimo, recebe a versão pública.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BandPresenter })
  @ApiResponse({
    status: 401,
    description:
      "O token enviado é de um integrante da banda, mas foi recusado (expirado). O cliente renova a sessão e repete.",
  })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser?: AuthenticatedUser,
    @RejectedTokenSub() rejectedTokenSub?: string,
  ) {
    const { band, is_member } = await this.getBandUseCase.execute({
      id,
      requesting_musician_id: currentUser?.userId ?? null,
      is_admin: currentUser?.isAdmin ?? false,
      // Só importa quando não há usuário autenticado — ver `GetBandUseCase`.
      rejected_token_sub: currentUser ? null : (rejectedTokenSub ?? null),
    });
    return is_member
      ? BandsController.serialize(band)
      : new PublicBandPresenter(band);
  }

  @Patch(":id")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Atualizar banda",
    description:
      "Atualiza os dados de apresentação da banda: nome, descrição, gêneros, ano de formação, faixa de preço e endereço. Só o líder atual. `open_to_gigs` tem rota própria.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BandPresenter })
  @ApiResponse({ status: 403, description: "Quem pede não é o líder atual" })
  async update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateBandDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    /*
     * 🔴 `...dto`, e não uma lista de campos escrita à mão.
     *
     * A lista à mão era o defeito: `formed_in` entrou no DTO e no use-case em
     * set/2026 e ninguém o acrescentou aqui. O app mandava o ano, a rota
     * respondia 200 e nada era gravado — "tempo de estrada" nunca salvou.
     * O DTO já é a allowlist; repeti-la campo a campo só cria um segundo lugar
     * para esquecer. `id` e o ator vêm DEPOIS do spread, para que nada do
     * corpo os sobrescreva.
     */
    const output = await this.updateBandUseCase.execute(
      new UpdateBandInput({
        ...dto,
        id,
        ...BandsController.actorOf(currentUser),
      }),
    );
    return BandsController.serialize(output);
  }

  @Patch(":id/open-to-gigs")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Definir disponibilidade da banda para contratação",
    description:
      "Consentimento explícito do líder para a banda aparecer na busca de estabelecimentos — independente do open_to_gigs individual de cada membro. Nunca ligado por padrão.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BandPresenter })
  @ApiResponse({ status: 403, description: "Quem pede não é o líder atual" })
  async setOpenToGigs(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: SetBandOpenToGigsDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const output = await this.setBandOpenToGigsUseCase.execute(
      new SetBandOpenToGigsInput({
        band_id: id,
        open_to_gigs: dto.open_to_gigs,
        ...BandsController.actorOf(currentUser),
      }),
    );
    return BandsController.serialize(output);
  }

  @Delete(":id")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Dissolver banda",
    description:
      "Só o líder atual. Banda sem nenhum registro é apagada (`outcome: deleted`). Banda com histórico de shows, contratos ou gorjetas é arquivada (`outcome: archived`): some da busca e não recebe proposta, mas o nome continua nos registros antigos. Com compromisso em aberto a rota recusa.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: DissolveBandPresenter })
  @ApiResponse({ status: 403, description: "Quem pede não é o líder atual" })
  @ApiResponse({
    status: 409,
    description:
      "A banda tem show futuro, conversa de contratação aberta, cachê em custódia ou set no ar",
  })
  async remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const output = await this.dissolveBandUseCase.execute(
      new DissolveBandInput({ id, ...BandsController.actorOf(currentUser) }),
    );
    return new DissolveBandPresenter(output);
  }

  @Post(":id/members")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Convidar integrante para a banda",
    description:
      "Só o líder atual. Convida um músico (fica pending até o próprio músico aceitar ou recusar via /invites). Convidar de novo quem recusou reativa o convite. Exige plano com banda e respeita o teto de integrantes do plano.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: BandPresenter })
  @ApiResponse({
    status: 402,
    description: "Plano do líder não permite convidar, ou teto atingido",
  })
  @ApiResponse({ status: 403, description: "Quem pede não é o líder atual" })
  async addMember(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    band_id: string,
    @Body() dto: InviteBandMemberDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const output = await this.inviteBandMemberUseCase.execute(
      new InviteBandMemberInput({
        band_id,
        musician_id: dto.musician_id,
        instrument: dto.instrument,
        ...BandsController.actorOf(currentUser),
      }),
    );
    return BandsController.serialize(output);
  }

  @Post(":id/invites/accept")
  @HttpCode(200)
  @Roles("musician")
  @ApiOperation({
    summary: "Aceitar convite de banda",
    description:
      "O músico autenticado aceita seu próprio convite pendente para esta banda. musician_id vem sempre do token — não é possível aceitar convite de outro músico.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BandPresenter })
  async acceptInvite(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const output = await this.acceptBandInviteUseCase.execute({
      band_id: id,
      musician_id: currentUser.userId,
    });
    // Aceitou: passou a ser integrante, e recebe a banda por dentro.
    return BandsController.serialize(output);
  }

  @Post(":id/invites/decline")
  @HttpCode(200)
  @Roles("musician")
  @ApiOperation({
    summary: "Recusar convite de banda",
    description:
      "O músico autenticado recusa seu próprio convite pendente para esta banda. musician_id vem sempre do token.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: PublicBandPresenter })
  async declineInvite(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const output = await this.declineBandInviteUseCase.execute({
      band_id: id,
      musician_id: currentUser.userId,
    });
    // Recusou: continua de fora, e recebe a banda como qualquer terceiro.
    return new PublicBandPresenter(output);
  }

  @Patch(":id/leadership")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Transferir liderança da banda",
    description:
      "Passa a liderança para outro integrante aceito. Só o líder atual (ou admin) transfere. É o único caminho para trocar quem decide pela banda — remover ou rebaixar o líder é bloqueado justamente para não deixar a banda sem quem aceite show.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BandPresenter })
  @ApiResponse({ status: 403, description: "Quem pede não é o líder atual" })
  @ApiResponse({
    status: 422,
    description: "Sucessor não é membro aceito da banda",
  })
  async transferLeadership(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    band_id: string,
    @Body() dto: TransferBandLeadershipDto,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const input = new TransferBandLeadershipInput({
      band_id,
      new_leader_musician_id: dto.new_leader_musician_id,
      ...BandsController.actorOf(currentUser),
    });
    const output = await this.transferBandLeadershipUseCase.execute(input);
    return BandsController.serialize(output);
  }

  /*
   * `:musician_id`, e não `:musicianId` — o resto da API é snake_case, e é o
   * nome que os ownership guards procuram primeiro em rotas aninhadas.
   */
  @HttpCode(204)
  @Delete(":id/members/:musician_id")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Remover integrante, cancelar convite ou sair da banda",
    description:
      "O líder remove um integrante ou cancela um convite. Qualquer músico remove A SI MESMO: é como um integrante sai da banda e como um convidado desiste do convite. O líder não é removido enquanto houver outros integrantes — transfira a liderança antes.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "musician_id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  @ApiResponse({
    status: 403,
    description: "Remover outra pessoa exige ser o líder atual",
  })
  async removeMember(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    band_id: string,
    @Param("musician_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    await this.removeBandMemberUseCase.execute(
      new RemoveBandMemberInput({
        band_id,
        musician_id,
        ...BandsController.actorOf(currentUser),
      }),
    );
  }

  /** Quem está pedindo — sempre do token, nunca do corpo. */
  private static actorOf(currentUser: AuthenticatedUser) {
    return {
      requesting_musician_id: currentUser.userId,
      is_admin: currentUser.isAdmin,
    };
  }

  static serialize(output: BandOutput) {
    return new BandPresenter(output);
  }
}
