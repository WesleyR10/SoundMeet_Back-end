import { IsBoolean, IsNumber, IsOptional, Max, Min } from "class-validator";

/**
 * Leitura de GPS do fã enviada no check-in e em cada pedido de música.
 *
 * Classe com decorators (nunca `implements`): `forbidNonWhitelisted` reprova
 * propriedade sem metadata, e é por `@ValidateNested` + `@Type` que ela chega
 * aqui de dentro dos DTOs. Ver `dto-validation-coverage.spec.ts`.
 *
 * Os limites são de PLAUSIBILIDADE, não de regra: quem decide se a leitura
 * serve é o `PresenceVerifier`.
 */
export class PresenceLocationInput {
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude: number;

  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude: number;

  @IsNumber()
  @Min(0)
  @Max(100_000)
  accuracy_m: number;

  @IsBoolean()
  @IsOptional()
  mocked?: boolean;
}
