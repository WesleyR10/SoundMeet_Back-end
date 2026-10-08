import {
  registerDecorator,
  ValidationArguments,
  ValidationOptions,
} from "class-validator";

import { inspectExternalUrl } from "../../domain/value-objects/external-url.vo";

/**
 * URL pública de terceiro digitada pelo usuário (ex.: `website` do
 * estabelecimento). Exige `https://`, host público válido, sem userinfo, sem
 * `%`/não-ASCII no host e sem IP cru.
 *
 * 🔴 INP-2: o campo era `@IsString()` + `@MaxLength(500)`, ou seja, qualquer
 * texto. `javascript:alert(1)` e `http://169.254.169.254/latest/meta-data/`
 * entravam e eram servidos de volta por `GET /establishments/:id`, que é
 * `@Public()`.
 *
 * ⚠️ Não é `@IsUrl()`: aquele aceita `http://` (downgrade) e aceita userinfo,
 * que é o vetor `https://soundmeet.com.br@evil.example/`.
 */
export function IsExternalUrl(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: "isExternalUrl",
      target: object.constructor,
      propertyName,
      options: validationOptions,
      validator: {
        validate(value: unknown): boolean {
          // Campo opcional vazio é ausência, não valor inválido.
          if (value === undefined || value === null || value === "") {
            return true;
          }
          if (typeof value !== "string") return false;

          return inspectExternalUrl(value).ok;
        },
        defaultMessage(args: ValidationArguments): string {
          return `${args.property} must be an https:// URL with a public host`;
        },
      },
    });
  };
}
