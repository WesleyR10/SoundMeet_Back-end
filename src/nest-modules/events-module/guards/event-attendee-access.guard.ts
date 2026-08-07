import {
  ExecutionContext,
  ForbiddenException,
  Injectable,
} from "@nestjs/common";
import { Request } from "express";

import { AuthenticatedUser } from "../../auth-module/interfaces/authenticated-user.interface";
import { EstablishmentOwnershipGuard } from "../../auth-module/ownership/establishment-ownership.guard";

/**
 * Policy role-aware das rotas de presença (`:event_id/attendees`), que aceitam
 * audience, establishment e admin no mesmo endpoint:
 *
 * - audience: opera apenas sobre si mesmo — o controller descarta o
 *   `audience_id` recebido e usa o `sub` do JWT, então não há o que checar aqui;
 * - establishment: precisa ser dono do estabelecimento do `:id` da rota. Sem
 *   isto bastava conhecer os UUIDs para mexer na presença de evento alheio (o
 *   use case só valida que o evento pertence ao `establishment_id` informado,
 *   não que o autenticado seja aquele estabelecimento);
 * - admin: liberado explicitamente, como nos demais ownership guards.
 */
@Injectable()
export class EventAttendeeAccessGuard extends EstablishmentOwnershipGuard {
  canActivate(context: ExecutionContext): boolean {
    if (context.getType() !== "http") {
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const currentUser = request.currentUser as AuthenticatedUser | undefined;

    if (!currentUser) {
      throw new ForbiddenException();
    }

    if (!currentUser.isAdmin && currentUser.roles.includes("audience")) {
      return true;
    }

    return super.canActivate(context);
  }
}
