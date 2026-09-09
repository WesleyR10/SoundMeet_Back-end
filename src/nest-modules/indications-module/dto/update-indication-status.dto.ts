import { ApiProperty } from "@nestjs/swagger";
import { IsIn, IsNotEmpty } from "class-validator";

/**
 * Só "seen" e "archived": "new" é o estado de nascimento e não pode ser
 * restaurado pelo cliente — desmarcar como não lida reabriria o badge sem que
 * nada de novo tivesse chegado.
 */
export const UPDATABLE_INDICATION_STATUSES = ["seen", "archived"] as const;

export class UpdateIndicationStatusDto {
  @ApiProperty({ enum: UPDATABLE_INDICATION_STATUSES })
  @IsIn(UPDATABLE_INDICATION_STATUSES as unknown as string[])
  @IsNotEmpty()
  status: (typeof UPDATABLE_INDICATION_STATUSES)[number];
}
