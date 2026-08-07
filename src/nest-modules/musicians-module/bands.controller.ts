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
import { DeleteBandUseCase } from "../../core/musician/application/use-cases/delete-band/delete-band.use-case";
import { GetBandUseCase } from "../../core/musician/application/use-cases/get-band/get-band.use-case";
import { InviteBandMemberInput } from "../../core/musician/application/use-cases/invite-band-member/invite-band-member.input";
import { InviteBandMemberUseCase } from "../../core/musician/application/use-cases/invite-band-member/invite-band-member.use-case";
import { ListBandsUseCase } from "../../core/musician/application/use-cases/list-bands/list-bands.use-case";
import { RemoveBandMemberUseCase } from "../../core/musician/application/use-cases/remove-band-member/remove-band-member.use-case";
import { SetBandOpenToGigsUseCase } from "../../core/musician/application/use-cases/set-band-open-to-gigs/set-band-open-to-gigs.use-case";
import { TransferBandLeadershipInput } from "../../core/musician/application/use-cases/transfer-band-leadership/transfer-band-leadership.input";
import { TransferBandLeadershipUseCase } from "../../core/musician/application/use-cases/transfer-band-leadership/transfer-band-leadership.use-case";
import { UpdateBandInput } from "../../core/musician/application/use-cases/update-band/update-band.input";
import { UpdateBandUseCase } from "../../core/musician/application/use-cases/update-band/update-band.use-case";
import {
  AuthenticatedUser,
  AuthGuard,
  BandOwnershipGuard,
  CurrentUser,
  CurrentUserContextGuard,
  Public,
  Roles,
  RolesGuard,
} from "../auth-module";
import { BandCollectionPresenter, BandPresenter } from "./band.presenter";
import { CreateBandDto } from "./dto/create-band.dto";
import { InviteBandMemberDto } from "./dto/invite-band-member.dto";
import { RemoveBandMemberDto } from "./dto/remove-band-member.dto";
import { SearchBandsDto } from "./dto/search-bands.dto";
import { SetBandOpenToGigsDto } from "./dto/set-band-open-to-gigs.dto";
import { TransferBandLeadershipDto } from "./dto/transfer-band-leadership.dto";
import { UpdateBandDto } from "./dto/update-band.dto";

@ApiTags("Bands")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("bands")
export class BandsController {
  @Inject(CreateBandUseCase)
  private createBandUseCase: CreateBandUseCase;

  @Inject(UpdateBandUseCase)
  private updateBandUseCase: UpdateBandUseCase;

  @Inject(DeleteBandUseCase)
  private deleteBandUseCase: DeleteBandUseCase;

  @Inject(GetBandUseCase)
  private getBandUseCase: GetBandUseCase;

  @Inject(ListBandsUseCase)
  private listBandsUseCase: ListBandsUseCase;

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

  @Post()
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Criar banda",
    description:
      "Cria uma banda. O músico autenticado é automaticamente adicionado como líder.",
  })
  @ApiResponse({ status: 201, type: BandPresenter })
  async create(
    @Body() dto: CreateBandDto,
    @CurrentUser() currentUser?: AuthenticatedUser,
  ) {
    const output = await this.createBandUseCase.execute(
      new CreateBandInput({
        ...dto,
        creator_musician_id: currentUser?.userId,
      }),
    );
    return BandsController.serialize(output);
  }

  @Get()
  @Public()
  @ApiOperation({
    summary: "Listar bandas",
    description: "Lista bandas com paginação, ordenação e filtros.",
  })
  @ApiResponse({ status: 200, type: BandCollectionPresenter })
  async findAll(@Query() query: SearchBandsDto) {
    const output = await this.listBandsUseCase.execute(query);
    return new BandCollectionPresenter(output);
  }

  @Get(":id")
  @Public()
  @ApiOperation({
    summary: "Buscar banda por ID",
    description: "Retorna os detalhes da banda, incluindo membros.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BandPresenter })
  async findOne(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    const output = await this.getBandUseCase.execute({ id });
    return BandsController.serialize(output);
  }

  @Patch(":id")
  @Roles("musician", "admin")
  @UseGuards(BandOwnershipGuard)
  @ApiOperation({
    summary: "Atualizar banda",
    description: "Atualiza dados da banda.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BandPresenter })
  async update(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: UpdateBandDto,
  ) {
    const output = await this.updateBandUseCase.execute(
      new UpdateBandInput({
        id,
        name: dto.name,
        description: dto.description,
        avatar: dto.avatar,
        genres: dto.genres,
        priceRange: dto.priceRange,
        address: dto.address,
        open_to_gigs: dto.open_to_gigs,
        is_active: dto.is_active,
      }),
    );
    return BandsController.serialize(output);
  }

  @Patch(":id/open-to-gigs")
  @Roles("musician", "admin")
  @UseGuards(BandOwnershipGuard)
  @ApiOperation({
    summary: "Definir disponibilidade da banda para contratação",
    description:
      "Consentimento explícito do líder para a banda aparecer na busca de estabelecimentos — independente do open_to_gigs individual de cada membro. Nunca ligado por padrão.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BandPresenter })
  async setOpenToGigs(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: SetBandOpenToGigsDto,
  ) {
    const output = await this.setBandOpenToGigsUseCase.execute({
      band_id: id,
      open_to_gigs: dto.open_to_gigs,
    });
    return BandsController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id")
  @Roles("musician", "admin")
  @UseGuards(BandOwnershipGuard)
  @ApiOperation({
    summary: "Excluir banda",
    description: "Exclui uma banda pelo ID.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async remove(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
  ) {
    await this.deleteBandUseCase.execute({ id });
  }

  @Post(":id/members")
  @Roles("musician", "admin")
  @UseGuards(BandOwnershipGuard)
  @ApiOperation({
    summary: "Convidar membro para a banda",
    description:
      "Convida um músico para a banda (fica pending até o próprio músico aceitar ou recusar via /invites).",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: BandPresenter })
  async addMember(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    band_id: string,
    @Body() dto: InviteBandMemberDto,
  ) {
    const input = new InviteBandMemberInput({
      band_id,
      musician_id: dto.musician_id,
      role: dto.role,
      instrument: dto.instrument,
    });
    const output = await this.inviteBandMemberUseCase.execute(input);
    return BandsController.serialize(output);
  }

  @Post(":id/invites/accept")
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
    return BandsController.serialize(output);
  }

  @Post(":id/invites/decline")
  @Roles("musician")
  @ApiOperation({
    summary: "Recusar convite de banda",
    description:
      "O músico autenticado recusa seu próprio convite pendente para esta banda. musician_id vem sempre do token.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: BandPresenter })
  async declineInvite(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @CurrentUser() currentUser: AuthenticatedUser,
  ) {
    const output = await this.declineBandInviteUseCase.execute({
      band_id: id,
      musician_id: currentUser.userId,
    });
    return BandsController.serialize(output);
  }

  @Patch(":id/leadership")
  @Roles("musician", "admin")
  @UseGuards(BandOwnershipGuard)
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
      requesting_musician_id: currentUser.userId,
      is_admin: currentUser.isAdmin,
    });
    const output = await this.transferBandLeadershipUseCase.execute(input);
    return BandsController.serialize(output);
  }

  @HttpCode(204)
  @Delete(":id/members/:musicianId")
  @Roles("musician", "admin")
  @UseGuards(BandOwnershipGuard)
  @ApiOperation({
    summary: "Remover membro da banda",
    description: "Remove um músico de uma banda.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiParam({ name: "musicianId", required: true, format: "uuid" })
  @ApiResponse({ status: 204 })
  async removeMember(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    band_id: string,
    @Param("musicianId", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    musician_id: string,
  ) {
    const input: RemoveBandMemberDto = {
      band_id,
      musician_id,
    } as RemoveBandMemberDto;
    await this.removeBandMemberUseCase.execute(input);
  }

  static serialize(output: BandOutput) {
    return new BandPresenter(output);
  }
}
