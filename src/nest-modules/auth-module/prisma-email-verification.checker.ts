import { Injectable } from "@nestjs/common";

import { IEmailVerificationChecker } from "../../core/shared/domain/email-verification.checker";
import { PrismaService } from "../database-module/prisma/prisma.service";

/**
 * Adapter Prisma da porta `IEmailVerificationChecker`.
 *
 * Lê `email_verified_at` direto da tabela: o campo é infra-only por decisão
 * registrada em `Docs/email.md` — não pertence ao agregado e é gerenciado pelo
 * `VerifyEmailService`. É o mesmo motivo pelo qual a porta existe.
 */
@Injectable()
export class PrismaEmailVerificationChecker implements IEmailVerificationChecker {
  constructor(private readonly prisma: PrismaService) {}

  async isMusicianEmailVerified(musicianId: string): Promise<boolean> {
    const musician = await this.prisma.musician.findUnique({
      where: { id: musicianId },
      select: { email_verified_at: true },
    });

    // 🔴 Músico inexistente responde `false`, nunca `true`. A porta é
    // consumida para liberar movimentação de dinheiro; falhar para o lado
    // aberto por "não achei" é o modo de falha que o gate existe para impedir.
    return !!musician?.email_verified_at;
  }
}
