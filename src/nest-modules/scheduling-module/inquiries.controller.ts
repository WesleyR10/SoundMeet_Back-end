import {
  Body,
  Controller,
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

import { AcceptInquiryUseCase } from "../../core/scheduling/application/use-cases/accept-inquiry/accept-inquiry.use-case";
import { BookingOutput } from "../../core/scheduling/application/use-cases/common/booking-output";
import { InquiryOutput } from "../../core/scheduling/application/use-cases/common/inquiry-output";
import { ConvertInquiryToBookingInput } from "../../core/scheduling/application/use-cases/convert-inquiry-to-booking/convert-inquiry-to-booking.input";
import { ConvertInquiryToBookingUseCase } from "../../core/scheduling/application/use-cases/convert-inquiry-to-booking/convert-inquiry-to-booking.use-case";
import { CreateInquiryInput } from "../../core/scheduling/application/use-cases/create-inquiry/create-inquiry.input";
import { CreateInquiryUseCase } from "../../core/scheduling/application/use-cases/create-inquiry/create-inquiry.use-case";
import { ListInquiriesUseCase } from "../../core/scheduling/application/use-cases/list-inquiries/list-inquiries.use-case";
import { RejectInquiryUseCase } from "../../core/scheduling/application/use-cases/reject-inquiry/reject-inquiry.use-case";
import {
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  resolveParticipantIds,
  Roles,
  RolesGuard,
} from "../auth-module";
import { AuthenticatedUser } from "../auth-module/interfaces/authenticated-user.interface";
import { BookingPresenter } from "./booking.presenter";
import { AcceptInquiryDto } from "./dto/accept-inquiry.dto";
import { ConvertInquiryToBookingDto } from "./dto/convert-inquiry-to-booking.dto";
import { CreateInquiryDto } from "./dto/create-inquiry.dto";
import { RejectInquiryDto } from "./dto/reject-inquiry.dto";
import { SearchInquiriesDto } from "./dto/search-inquiries.dto";
import {
  InquiryCollectionPresenter,
  InquiryPresenter,
} from "./inquiry.presenter";

@ApiTags("Scheduling")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("scheduling/inquiries")
export class InquiriesController {
  @Inject(CreateInquiryUseCase)
  private createInquiryUseCase: CreateInquiryUseCase;

  @Inject(AcceptInquiryUseCase)
  private acceptInquiryUseCase: AcceptInquiryUseCase;

  @Inject(RejectInquiryUseCase)
  private rejectInquiryUseCase: RejectInquiryUseCase;

  @Inject(ConvertInquiryToBookingUseCase)
  private convertInquiryToBookingUseCase: ConvertInquiryToBookingUseCase;

  @Inject(ListInquiriesUseCase)
  private listInquiriesUseCase: ListInquiriesUseCase;

  @Get()
  @Roles("establishment", "musician", "admin")
  @ApiOperation({
    summary: "Listar propostas do usuário autenticado",
    description:
      "Caixa de entrada dos dois lados: o estabelecimento acompanha o que enviou, o músico vê o que recebeu (direto ou por uma banda que integra). O escopo vem SEMPRE do token; os filtros de query só refinam dentro dele. Admin vê tudo.",
  })
  @ApiResponse({ status: 200, type: InquiryCollectionPresenter })
  async search(
    @Query() query: SearchInquiriesDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.listInquiriesUseCase.execute({
      ...query,
      requesting_participant_ids: resolveParticipantIds(user),
      is_admin: user?.isAdmin,
    });
    return new InquiryCollectionPresenter(output);
  }

  @Post()
  @Roles("establishment", "musician", "admin")
  @ApiOperation({
    summary: "Criar inquiry",
    description:
      "Cria uma negociação (sem chat) para futura proposta de booking.",
  })
  @ApiResponse({ status: 201, type: InquiryPresenter })
  async create(
    @Body() dto: CreateInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.createInquiryUseCase.execute(
      new CreateInquiryInput({
        ...dto,
        requesting_participant_ids: resolveParticipantIds(user),
        requesting_musician_id: user?.userId,
        is_admin: user.isAdmin,
      }),
    );
    return InquiriesController.serializeInquiry(output);
  }

  @Patch(":id/accept")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Aceitar inquiry",
    description: "Marca inquiry como aceita pelo músico/banda.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: InquiryPresenter })
  async accept(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() _dto: AcceptInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.acceptInquiryUseCase.execute({
      inquiry_id: id,
      requesting_participant_ids: resolveParticipantIds(user),
      requesting_musician_id: user?.userId,
      is_admin: user.isAdmin,
    });
    return InquiriesController.serializeInquiry(output);
  }

  @Patch(":id/reject")
  @Roles("musician", "admin")
  @ApiOperation({
    summary: "Rejeitar inquiry",
    description: "Marca inquiry como rejeitada pelo músico/banda.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: InquiryPresenter })
  async reject(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: RejectInquiryDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.rejectInquiryUseCase.execute({
      inquiry_id: id,
      reason: dto.reason ?? null,
      requesting_participant_ids: resolveParticipantIds(user),
      requesting_musician_id: user?.userId,
      is_admin: user.isAdmin,
    });
    return InquiriesController.serializeInquiry(output);
  }

  @Post(":id/convert-to-booking")
  @Roles("establishment", "musician", "admin")
  @HttpCode(201)
  @ApiOperation({
    summary: "Converter inquiry em booking",
    description:
      "Cria booking pending a partir de inquiry aceita e marca inquiry como convertida.",
  })
  @ApiParam({ name: "id", required: true, format: "uuid" })
  @ApiResponse({ status: 201, type: BookingPresenter })
  async convertToBooking(
    @Param("id", new ParseUUIDPipe({ errorHttpStatusCode: 422 })) id: string,
    @Body() dto: ConvertInquiryToBookingDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.convertInquiryToBookingUseCase.execute(
      new ConvertInquiryToBookingInput({
        inquiry_id: id,
        start_at: dto.start_at,
        end_at: dto.end_at,
        fee: dto.fee,
        notes: dto.notes,
        buffer_minutes: dto.buffer_minutes,
        expires_at: dto.expires_at,
        requesting_participant_ids: resolveParticipantIds(user),
        requesting_musician_id: user?.userId,
        is_admin: user.isAdmin,
      }),
    );
    return InquiriesController.serializeBooking(output);
  }

  static serializeInquiry(output: InquiryOutput) {
    return new InquiryPresenter(output);
  }

  static serializeBooking(output: BookingOutput) {
    return new BookingPresenter(output);
  }
}
