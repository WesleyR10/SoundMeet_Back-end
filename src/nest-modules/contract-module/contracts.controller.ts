import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Inject,
  Ip,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  Res,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from "@nestjs/swagger";
import { Throttle } from "@nestjs/throttler";
import type { Response } from "express";

import { AnnulContractUseCase } from "../../core/contract/application/use-cases/annul-contract/annul-contract.use-case";
import { GetContractUseCase } from "../../core/contract/application/use-cases/get-contract/get-contract.use-case";
import { GetContractDocumentUseCase } from "../../core/contract/application/use-cases/get-contract-document/get-contract-document.use-case";
import { IssueContractUseCase } from "../../core/contract/application/use-cases/issue-contract/issue-contract.use-case";
import { ListContractsUseCase } from "../../core/contract/application/use-cases/list-contracts/list-contracts.use-case";
import { NotifyContractPartiesUseCase } from "../../core/contract/application/use-cases/notify-contract-parties/notify-contract-parties.use-case";
import { RequestSignatureChallengeUseCase } from "../../core/contract/application/use-cases/request-signature-challenge/request-signature-challenge.use-case";
import { SignContractUseCase } from "../../core/contract/application/use-cases/sign-contract/sign-contract.use-case";
import { ContractStatus } from "../../core/contract/domain/contract-types";
import { SortDirection } from "../../core/shared/domain/repository/search-params";
import {
  AuthGuard,
  CurrentUser,
  CurrentUserContextGuard,
  resolveParticipantIds,
  Roles,
  RolesGuard,
} from "../auth-module";
import { AuthenticatedUser } from "../auth-module/interfaces/authenticated-user.interface";
import {
  ContractCollectionPresenter,
  ContractDeliveryPresenter,
  ContractPresenter,
  SignatureChallengePresenter,
} from "./contract.presenter";
import {
  AnnulContractDto,
  GetContractDocumentQueryDto,
  IssueContractDto,
  SearchContractsDto,
  SignContractDto,
} from "./dto/contract.dto";

/**
 * Rotas do contrato digital, para as duas personas.
 *
 * ## Escopo e autorização
 *
 * Como em `bookings.controller.ts`, **não há guard de ownership**: o escopo sai
 * de `resolveParticipantIds(user)` (o `sub` mais os claims `establishment_ids`
 * e `band_ids`) e a autorização real acontece dentro do use case, que sabe quem
 * são as partes daquele contrato. Um `MusicianOwnershipGuard` aqui não teria o
 * que resolver: o dono do contrato pode ser um estabelecimento.
 *
 * ⚠️ O parâmetro é **`:contract_id`, nunca `:id`** — os `FALLBACK_PARAMS` do
 * `MusicianOwnershipGuard` resolvem por `["musician_id","musicianId","id"]`, e
 * um `:id` de sub-recurso colide. Aqui não há esse guard, mas a convenção é
 * barata e o repositório já pagou por quebrá-la.
 */
@ApiTags("Contracts")
@ApiBearerAuth("JWT-auth")
@UseGuards(AuthGuard, RolesGuard, CurrentUserContextGuard)
@Controller("contracts")
export class ContractsController {
  @Inject(ListContractsUseCase)
  private listUseCase: ListContractsUseCase;

  @Inject(GetContractUseCase)
  private getUseCase: GetContractUseCase;

  @Inject(SignContractUseCase)
  private signUseCase: SignContractUseCase;

  @Inject(RequestSignatureChallengeUseCase)
  private requestChallengeUseCase: RequestSignatureChallengeUseCase;

  @Inject(NotifyContractPartiesUseCase)
  private notifyUseCase: NotifyContractPartiesUseCase;

  @Inject(IssueContractUseCase)
  private issueUseCase: IssueContractUseCase;

  @Inject(AnnulContractUseCase)
  private annulUseCase: AnnulContractUseCase;

  @Inject(GetContractDocumentUseCase)
  private documentUseCase: GetContractDocumentUseCase;

  @Get()
  @Roles("establishment", "musician", "admin")
  @ApiOperation({
    summary: "Listar meus contratos",
    description:
      "Escopado pelo token: casa todas as identidades do usuário contra estabelecimento, músico e banda. Filtros de query apenas refinam dentro desse escopo.",
  })
  @ApiResponse({ status: 200, type: ContractCollectionPresenter })
  async search(
    @Query() searchParams: SearchContractsDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.listUseCase.execute({
      page: searchParams.page,
      per_page: searchParams.per_page,
      sort: searchParams.sort,
      sort_dir: searchParams.sort_dir as SortDirection,
      status: searchParams.status as ContractStatus,
      booking_id: searchParams.booking_id,
      requesting_participant_ids: resolveParticipantIds(user),
      is_admin: user.roles?.includes("admin"),
    });

    return new ContractCollectionPresenter(output);
  }

  // `@Get(":contract_id")` depois de `@Get()` e antes dos `@Post`, para o
  // roteador não capturar "contracts" como id.
  @Get(":contract_id")
  @Roles("establishment", "musician", "admin")
  @ApiOperation({
    summary: "Ver um contrato",
    description:
      "Devolve o snapshot congelado inteiro — é a fonte que as UIs renderizam nativamente. Ver não exige liderança de banda: todo integrante lê o contrato do show que vai tocar.",
  })
  @ApiParam({ name: "contract_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: ContractPresenter })
  @ApiResponse({ status: 403, description: "Não é parte deste contrato." })
  async findOne(
    @Param("contract_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    contractId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.getUseCase.execute({
      contract_id: contractId,
      requesting_participant_ids: resolveParticipantIds(user),
      is_admin: user.roles?.includes("admin"),
    });

    return new ContractPresenter(output);
  }

  /**
   * Download do documento.
   *
   * Faz stream a partir do storage **privado** — não redireciona para bucket e
   * não devolve URL. É a contrapartida de `IContractStorage` não ter
   * `getPublicUrl`: a autorização acontece antes de qualquer byte sair.
   */
  @Get(":contract_id/document")
  @Roles("establishment", "musician", "admin")
  @ApiOperation({
    summary: "Baixar o contrato ou o certificado de assinatura",
    description:
      "Stream autorizado a partir do storage privado. `kind=certificate` devolve o Anexo II, disponível só depois das duas assinaturas.",
  })
  @ApiParam({ name: "contract_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, description: "application/pdf" })
  async document(
    @Param("contract_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    contractId: string,
    @Query() query: GetContractDocumentQueryDto,
    @CurrentUser() user: AuthenticatedUser,
    @Res() response: Response,
  ) {
    const output = await this.documentUseCase.execute({
      contract_id: contractId,
      kind: query.kind,
      requesting_participant_ids: resolveParticipantIds(user),
      is_admin: user.roles?.includes("admin"),
    });

    response.setHeader("Content-Type", output.content_type);
    response.setHeader(
      "Content-Disposition",
      `attachment; filename="${output.filename}"`,
    );
    if (output.content_length !== null) {
      response.setHeader("Content-Length", output.content_length);
    }
    // Documento com CPF e valor não entra em cache de proxy.
    response.setHeader("Cache-Control", "private, no-store");

    output.data.pipe(response);
  }

  @Post(":contract_id/document/send")
  @Roles("establishment", "musician", "admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reenviar a própria cópia do contrato por e-mail",
    description:
      "Envia o PDF do contrato ao e-mail congelado da parte que pediu — nunca à outra parte, nunca a um destino do corpo. Existe porque a entrega automática (na emissão e no fechamento) pode falhar, e a falha precisa ser recuperável pela própria parte, não só visível no log.",
  })
  @ApiParam({ name: "contract_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: ContractDeliveryPresenter })
  @ApiResponse({ status: 403, description: "Não é parte, ou não é o líder." })
  async resendDocument(
    @Param("contract_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    contractId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    /*
     * Autorização e papel são derivados DENTRO do use-case, que é quem tem o
     * agregado em mãos. O controller só repassa os claims — derivar papel a
     * partir do DTO de saída exigiria repetir a regra aqui, onde ela
     * envelheceria em silêncio.
     */
    const output = await this.notifyUseCase.execute({
      contract_id: contractId,
      requesting_participant_ids: resolveParticipantIds(user),
      requesting_musician_id: user.userId,
      is_admin: user.roles?.includes("admin"),
    });

    return new ContractDeliveryPresenter(output);
  }

  /*
   * ⚠️ Declarada ANTES de `@Post(":contract_id/sign")`: o Express casa por
   * ordem, e `:contract_id/sign` não colide com `:contract_id/sign/challenge`
   * por serem segmentos diferentes — mas manter o mais específico primeiro é a
   * convenção já registrada neste controller para `@Get(":contract_id")`.
   */
  @Post(":contract_id/sign/challenge")
  @Roles("establishment", "musician", "admin")
  /*
   * Cada pedido invalida o código anterior e dispara um e-mail. Sem limite
   * próprio, o único freio seria o balde global (`RATE_LIMIT_MAX`), que é
   * generoso demais para uma ação que escreve na caixa de entrada de alguém —
   * e que, repetida, impede a própria parte de assinar (o código que ela
   * acabou de receber morre a cada nova emissão). Mesmo teto do
   * `POST /auth/register`.
   */
  @Throttle({ default: { ttl: 60000, limit: 5 } })
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Pedir o código de assinatura",
    description:
      "Envia um código de uso único ao e-mail congelado da parte no contrato. É o segundo fator da assinatura: a conta autenticada prova que alguém com a senha entrou, não quem. 🔴 O código NUNCA vem na resposta — ela traz só o destino mascarado e o vencimento.",
  })
  @ApiParam({ name: "contract_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: SignatureChallengePresenter })
  @ApiResponse({ status: 403, description: "Não é parte, ou não é o líder." })
  @ApiResponse({
    status: 422,
    description: "Esta parte já assinou, ou o contrato está anulado.",
  })
  async requestSignatureChallenge(
    @Param("contract_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    contractId: string,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    const output = await this.requestChallengeUseCase.execute({
      contract_id: contractId,
      requesting_user_id: user.userId,
      requesting_participant_ids: resolveParticipantIds(user),
      requesting_musician_id: user.userId,
      is_admin: user.roles?.includes("admin"),
    });

    return new SignatureChallengePresenter(output);
  }

  @Post(":contract_id/sign")
  @Roles("establishment", "musician", "admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Assinar o contrato",
    description:
      "Registra o aceite do lado a que o usuário pertence — o papel é DERIVADO do token, nunca do corpo. Em banda, só o líder assina. A segunda assinatura fecha o contrato e gera o certificado (Anexo II).",
  })
  @ApiParam({ name: "contract_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: ContractPresenter })
  @ApiResponse({ status: 403, description: "Não é parte, ou não é o líder." })
  @ApiResponse({
    status: 422,
    description: "Sem aceite explícito, já assinado por este lado, ou anulado.",
  })
  async sign(
    @Param("contract_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    contractId: string,
    @Body() dto: SignContractDto,
    @CurrentUser() user: AuthenticatedUser,
    @Ip() ip: string,
    @Headers("x-forwarded-for") forwardedFor: string | undefined,
    @Headers("user-agent") userAgent: string | undefined,
  ) {
    const output = await this.signUseCase.execute({
      contract_id: contractId,
      accept_terms: dto.accept_terms,
      challenge_code: dto.challenge_code,
      requesting_user_id: user.userId,
      requesting_participant_ids: resolveParticipantIds(user),
      requesting_musician_id: user.userId,
      is_admin: user.roles?.includes("admin"),
      /*
       * 🔴 O IP vai cru, com a cadeia de encaminhamento ao lado e SEM
       * interpretação. Confiar no `X-Forwarded-For` exige saber quantos proxies
       * existem na frente, e errar essa conta é como se falsifica origem. O
       * provider marca a procedência para que a trilha diga o que sabe.
       */
      observed_ip: ip ?? null,
      forwarded_for: forwardedFor ?? null,
      user_agent: userAgent ?? null,
    });

    return new ContractPresenter(output);
  }

  @Post("issue")
  @Roles("establishment", "musician", "admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Reemitir contrato pendente de qualificação",
    description:
      "O gatilho normal é a confirmação do booking. Esta rota é a RETENTATIVA depois de sanar uma pendência (CNPJ, CPF, endereço, cachê). Devolve 200 com `{ issued: false, missing: [...] }` quando ainda falta dado — não é erro, é o estado do cadastro. Aceita **apenas** `booking_id`: tom e exclusividade não são escolhidos na retentativa.",
  })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: "Não é parte deste show." })
  async issue(
    @Body() dto: IssueContractDto,
    @CurrentUser() user: AuthenticatedUser,
  ) {
    /*
     * 🔴 A autorização acontece DENTRO do use case, antes de qualquer efeito.
     *
     * Esta rota já foi a única do módulo sem checagem nenhuma: repassava o DTO
     * cru e só filtrava a leitura do resultado — quando o contrato alheio já
     * tinha nascido, o PDF já estava no storage e o e-mail já tinha saído para
     * as duas partes. Filtrar a saída não é autorizar a entrada.
     */
    const output = await this.issueUseCase.execute({
      ...dto,
      requesting_participant_ids: resolveParticipantIds(user),
      is_admin: user.roles?.includes("admin"),
    });

    if (!output.issued) {
      return { issued: false, missing: output.missing };
    }

    // Emitido: reaproveita a checagem do GetContract em vez de duplicar a regra
    // aqui. Hoje é redundância barata, não a única defesa.
    const contract = await this.getUseCase.execute({
      contract_id: output.contract.id,
      requesting_participant_ids: resolveParticipantIds(user),
      is_admin: user.roles?.includes("admin"),
    });

    return { issued: true, contract: new ContractPresenter(contract) };
  }

  @Post(":contract_id/annul")
  @Roles("admin")
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: "Anular contrato (admin)",
    description:
      "Só para contrato ainda não assinado por ambas as partes. Contrato ASSINADO nunca é anulado — ele é prova, e apagá-lo destruiria a evidência. Anulado libera nova emissão para o mesmo booking.",
  })
  @ApiParam({ name: "contract_id", required: true, format: "uuid" })
  @ApiResponse({ status: 200, type: ContractPresenter })
  @ApiResponse({ status: 422, description: "Contrato assinado ou já anulado." })
  async annul(
    @Param("contract_id", new ParseUUIDPipe({ errorHttpStatusCode: 422 }))
    contractId: string,
    @Body() dto: AnnulContractDto,
  ) {
    const output = await this.annulUseCase.execute({
      contract_id: contractId,
      reason: dto.reason,
    });

    return new ContractPresenter(output);
  }
}
