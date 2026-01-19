type OpenApiSchema = {
  $ref?: string;
  type?: string;
  format?: string;
  nullable?: boolean;
  properties?: Record<string, OpenApiSchema>;
  required?: string[];
  items?: OpenApiSchema;
  enum?: Array<string | number>;
  example?: any;
  default?: any;
  minimum?: number;
  maximum?: number;
  minLength?: number;
  maxLength?: number;
  pattern?: string;
  minItems?: number;
  maxItems?: number;
  allOf?: OpenApiSchema[];
  anyOf?: OpenApiSchema[];
  oneOf?: OpenApiSchema[];
};

export type SwaggerExampleRegistryItem = {
  pattern: RegExp;
  build: (ctx: {
    name: string;
    schema: OpenApiSchema;
    format?: string;
    pattern?: string;
  }) => any;
};

export type ApplySwaggerExamplesOptions = {
  enabled: boolean;
  includeOptionalProperties: boolean;
  registry: SwaggerExampleRegistryItem[];
};

const DEFAULT_UUID = "3fa85f64-5717-4562-b3fc-2c963f66afa6";

function schemaRefName(ref: string) {
  const match = ref.match(/^#\/components\/schemas\/(.+)$/);
  return match?.[1] ?? null;
}

function clampStringByLength(value: string, schema: OpenApiSchema) {
  let out = value;
  if (typeof schema.minLength === "number" && out.length < schema.minLength) {
    out = out.padEnd(schema.minLength, "a");
  }
  if (typeof schema.maxLength === "number" && out.length > schema.maxLength) {
    out = out.slice(0, schema.maxLength);
  }
  return out;
}

function createNumericString(length: number) {
  return Array.from({ length }, (_, i) => String((i + 1) % 10)).join("");
}

function createAlphaString(length: number) {
  return Array.from({ length }, (_, i) =>
    String.fromCharCode("A".charCodeAt(0) + (i % 26)),
  ).join("");
}

function exampleFromPattern(pattern: string) {
  const cleaned = pattern.trim();
  const pureDigits = cleaned.match(/^\^?\\d\{(\d+)\}\$?$/);
  if (pureDigits) return createNumericString(parseInt(pureDigits[1], 10));

  const pureDigitsAlt = cleaned.match(/^\^?\[0-9\]\{(\d+)\}\$?$/);
  if (pureDigitsAlt) return createNumericString(parseInt(pureDigitsAlt[1], 10));

  const pureAlpha = cleaned.match(/^\^?\[A-Z\]\{(\d+)\}\$?$/);
  if (pureAlpha) return createAlphaString(parseInt(pureAlpha[1], 10));

  const segmentedDigits = cleaned.match(
    /^\^?(?:\\d\{\d+\})(?:[-_. ]\\d\{\d+\})+\$?$/,
  );
  if (segmentedDigits) {
    const parts = cleaned
      .replace(/^\^?/, "")
      .replace(/\$?$/, "")
      .split(/[-_. ]/);
    const sep = cleaned.includes("-")
      ? "-"
      : cleaned.includes("_")
        ? "_"
        : cleaned.includes(".")
          ? "."
          : " ";
    return parts
      .map((p) => {
        const m = p.match(/\\d\{(\d+)\}/);
        return m ? createNumericString(parseInt(m[1], 10)) : "";
      })
      .join(sep);
  }

  return null;
}

function pickFromRegistry(
  name: string,
  schema: OpenApiSchema,
  registry: SwaggerExampleRegistryItem[],
) {
  for (const item of registry) {
    if (item.pattern.test(name)) {
      return item.build({
        name,
        schema,
        format: schema.format,
        pattern: schema.pattern,
      });
    }
  }
  return null;
}

function isPlainObject(value: any): value is Record<string, any> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function deepMergeExamples(a: any, b: any): any {
  if (!isPlainObject(a) || !isPlainObject(b)) return b;
  const out: Record<string, any> = { ...a };
  for (const [key, value] of Object.entries(b)) {
    if (key in out) {
      out[key] = deepMergeExamples(out[key], value);
    } else {
      out[key] = value;
    }
  }
  return out;
}

function isExampleCompatible(schema: OpenApiSchema, example: any) {
  if (schema.enum?.length) return schema.enum.includes(example);

  if (!schema.type) {
    if (schema.properties) return isPlainObject(example);
    if (schema.items) return Array.isArray(example);
    return true;
  }

  if (schema.type === "object") return isPlainObject(example);
  if (schema.type === "array") return Array.isArray(example);
  if (schema.type === "string") return typeof example === "string";
  if (schema.type === "boolean") return typeof example === "boolean";
  if (schema.type === "integer" || schema.type === "number")
    return typeof example === "number";

  return true;
}

function numberExampleForSchema(name: string, schema: OpenApiSchema) {
  const key = name.toLowerCase();
  const min = typeof schema.minimum === "number" ? schema.minimum : null;
  const max = typeof schema.maximum === "number" ? schema.maximum : null;

  const safeClamp = (val: number) => {
    if (min !== null && val < min) val = min;
    if (max !== null && val > max) val = max;
    return val;
  };

  if (key.includes("experience_years")) return safeClamp(5);

  if (key.includes("per_page") || key.includes("perpage")) return safeClamp(15);
  if (
    key === "page" ||
    key.includes("current_page") ||
    key.includes("last_page")
  )
    return safeClamp(1);
  if (key === "limit") return safeClamp(15);

  if (key.includes("points_earned")) return safeClamp(25);
  if (key.includes("points_to_next_level")) return safeClamp(75);
  if (key === "monthly" || key.includes("monthly_points")) return safeClamp(40);
  if (key === "total" || key.includes("total_points")) return safeClamp(250);

  if (key.includes("min_points")) return safeClamp(0);
  if (key.includes("max_points")) return safeClamp(1000);

  if (key === "level" || key.includes("current_level")) return safeClamp(2);
  if (key.includes("total_ratings")) return safeClamp(128);

  if (key.includes("year")) {
    if (max !== null && max <= 100) return safeClamp(5);
    return safeClamp(new Date().getFullYear());
  }
  if (key.includes("amount") || key.includes("valor") || key.includes("price"))
    return safeClamp(20);

  if (min !== null && max !== null) return safeClamp(Math.max(min, 1));
  if (min !== null) return min;
  if (max !== null) return Math.min(1, max);
  return 1;
}

function stringExampleFallback(name: string) {
  const key = name.toLowerCase();
  if (key.endsWith("_id") || key === "id") return DEFAULT_UUID;
  return "string";
}

function stringExampleForFormat(name: string, schema: OpenApiSchema) {
  const format = schema.format?.toLowerCase();
  if (format === "uuid") return DEFAULT_UUID;
  if (format === "email") return "email@example.com";
  if (format === "date-time") return new Date().toISOString();
  if (format === "date") return new Date().toISOString().slice(0, 10);
  if (format === "uri" || format === "url") return "https://example.com";
  return stringExampleFallback(name);
}

function resolveExampleValue(params: {
  name: string;
  schema: OpenApiSchema;
  schemas: Record<string, OpenApiSchema>;
  seen: Set<string>;
  options: ApplySwaggerExamplesOptions;
}): any {
  const { name, schema, schemas, seen, options } = params;

  if (schema.example !== undefined) return schema.example;
  if (schema.default !== undefined) return schema.default;
  if (schema.enum?.length) return schema.enum[0];

  const isStructuredObjectSchema =
    (schema.type === "object" || schema.type === undefined) &&
    (Boolean(schema.properties) ||
      Boolean(schema.allOf?.length) ||
      Boolean(schema.oneOf?.length) ||
      Boolean(schema.anyOf?.length));

  if (!isStructuredObjectSchema) {
    const fromRegistry = pickFromRegistry(name, schema, options.registry);
    if (fromRegistry !== null) {
      if (typeof fromRegistry === "string")
        return clampStringByLength(fromRegistry, schema);
      return fromRegistry;
    }
  }

  if (schema.pattern && schema.type === "string") {
    const fromPattern = exampleFromPattern(schema.pattern);
    if (typeof fromPattern === "string")
      return clampStringByLength(fromPattern, schema);
  }

  if (schema.$ref) {
    const refName = schemaRefName(schema.$ref);
    const refSchema = refName ? schemas[refName] : null;
    if (refName && refSchema) {
      ensureSchemaExamples(refName, refSchema, schemas, seen, options);
      return (
        refSchema.example ??
        resolveExampleValue({
          name: refName,
          schema: refSchema,
          schemas,
          seen,
          options,
        })
      );
    }
  }

  if (schema.allOf?.length) {
    let merged: any = {};
    let mergedAnyObject = false;

    for (const subSchema of schema.allOf) {
      const sub = resolveExampleValue({
        name,
        schema: subSchema,
        schemas,
        seen,
        options,
      });

      if (isPlainObject(sub)) {
        merged = deepMergeExamples(merged, sub);
        mergedAnyObject = true;
      } else if (!mergedAnyObject) {
        merged = sub;
      }
    }

    return merged;
  }

  const composite = schema.oneOf ?? schema.anyOf;
  if (composite?.length) {
    return resolveExampleValue({
      name,
      schema: composite[0],
      schemas,
      seen,
      options,
    });
  }

  if (schema.type === "array") {
    const item = schema.items ?? {};
    const minItems = typeof schema.minItems === "number" ? schema.minItems : 1;
    const count = Math.max(1, Math.min(minItems, 3));
    return Array.from({ length: count }, () =>
      resolveExampleValue({
        name,
        schema: item,
        schemas,
        seen,
        options,
      }),
    );
  }

  if (schema.type === "boolean") return true;

  if (schema.type === "integer" || schema.type === "number") {
    return numberExampleForSchema(name, schema);
  }

  if (schema.type === "string") {
    const value = stringExampleForFormat(name, schema);
    return clampStringByLength(value, schema);
  }

  if (
    (schema.type === "object" || schema.type === undefined) &&
    schema.properties
  ) {
    const example: Record<string, any> = {};
    const required = new Set(schema.required ?? []);
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      if (!options.includeOptionalProperties && !required.has(propName))
        continue;
      example[propName] = resolveExampleValue({
        name: propName,
        schema: propSchema,
        schemas,
        seen,
        options,
      });
    }
    return example;
  }

  return stringExampleFallback(name);
}

function ensureSchemaExamples(
  schemaName: string,
  schema: OpenApiSchema,
  schemas: Record<string, OpenApiSchema>,
  seen: Set<string>,
  options: ApplySwaggerExamplesOptions,
) {
  if (
    schema.example !== undefined &&
    isExampleCompatible(schema, schema.example)
  )
    return;
  if (seen.has(schemaName)) return;
  seen.add(schemaName);

  if (schema.allOf?.length) {
    schema.example = resolveExampleValue({
      name: schemaName,
      schema,
      schemas,
      seen,
      options,
    });
    return;
  }

  const composite = schema.oneOf ?? schema.anyOf;
  if (composite?.length) {
    schema.example = resolveExampleValue({
      name: schemaName,
      schema: composite[0],
      schemas,
      seen,
      options,
    });
    return;
  }

  if (
    (schema.type === "object" || schema.type === undefined) &&
    schema.properties
  ) {
    schema.example = resolveExampleValue({
      name: schemaName,
      schema,
      schemas,
      seen,
      options,
    });
  }
}

function renamePaginationPresenterToMeta(
  schemas: Record<string, OpenApiSchema>,
) {
  for (const schema of Object.values(schemas)) {
    if (!schema.properties) continue;
    const paginationProp = schema.properties.paginationPresenter;
    if (!paginationProp || schema.properties.meta) continue;

    schema.properties.meta = paginationProp;
    delete schema.properties.paginationPresenter;

    if (Array.isArray(schema.required)) {
      schema.required = schema.required.map((propName) =>
        propName === "paginationPresenter" ? "meta" : propName,
      );
    }
  }
}

export function defaultSwaggerExampleRegistry(): SwaggerExampleRegistryItem[] {
  return [
    { pattern: /^email$/i, build: () => "email@example.com" },
    { pattern: /password|senha/i, build: () => "ExampleSenha123!" },
    { pattern: /phone|telefone/i, build: () => "+5511999999999" },
    { pattern: /^platform$/i, build: () => "instagram" },
    { pattern: /^vote$/i, build: () => "up" },
    { pattern: /sort_dir/i, build: () => "asc" },
    { pattern: /^sort$/i, build: () => "created_at" },
    { pattern: /nickname/i, build: () => "Jão" },
    { pattern: /stage_name/i, build: () => "DJ Fulano" },
    { pattern: /preferred_languages/i, build: () => ["pt-BR", "en-US"] },
    {
      pattern: /benefits/i,
      build: () => ["Pedidos prioritários", "Acesso VIP"],
    },
    {
      pattern: /^badges$/i,
      build: () => ["Iniciante", "Fã de Carteirinha"],
    },
    { pattern: /is_anonymous/i, build: () => false },
    {
      pattern: /notification_settings/i,
      build: () => ({
        push_notifications: true,
        email_notifications: true,
        sms_notifications: false,
        marketing_emails: false,
      }),
    },
    {
      pattern: /privacy_settings/i,
      build: () => ({
        profile_visibility: "public",
        show_activity: true,
        show_favorites: true,
        allow_friend_requests: true,
      }),
    },
    {
      pattern: /discovery_settings/i,
      build: () => ({
        discoverable_by_email: true,
        discoverable_by_phone: false,
        show_in_suggestions: true,
        location_based_suggestions: true,
      }),
    },
    {
      pattern: /days/i,
      build: ({ schema }) =>
        schema.type === "array" ? ["friday", "saturday"] : "friday",
    },
    {
      pattern: /hours/i,
      build: ({ schema }) =>
        schema.type === "string"
          ? "19:00-23:00"
          : { start: "19:00", end: "23:00" },
    },
    {
      pattern: /availability/i,
      build: () => ({
        days: ["friday", "saturday"],
        hours: { start: "19:00", end: "23:00" },
      }),
    },
    {
      pattern: /operatinghours|operating_hours/i,
      build: () => ({
        monday: { open: "18:00", close: "02:00" },
        friday: { open: "18:00", close: "03:00" },
        saturday: { open: "18:00", close: "03:00" },
      }),
    },
    {
      pattern: /coordinates/i,
      build: () => ({ lat: -23.55052, lng: -46.633308 }),
    },
    {
      pattern: /^location$/i,
      build: () => ({
        city: "São Paulo",
        state: "SP",
        coordinates: { lat: -23.55052, lng: -46.633308 },
      }),
    },
    {
      pattern: /pricerange|price_range/i,
      build: () => ({ min: 200, max: 1000 }),
    },
    { pattern: /^genres$/i, build: () => ["Rock", "MPB"] },
    {
      pattern: /favorite_genres|music_genres|genre/i,
      build: ({ schema }) =>
        schema.type === "array" ? ["Rock", "Sertanejo"] : "Rock",
    },
    {
      pattern: /preferredgenres|preferred_genres/i,
      build: () => ["Rock", "Pop"],
    },
    { pattern: /^instruments$/i, build: () => ["Guitar", "Vocal"] },
    {
      pattern: /favorite_instruments|instrument/i,
      build: ({ schema }) =>
        schema.type === "array" ? ["Guitar", "Voice"] : "Guitar",
    },
    {
      pattern: /members/i,
      build: ({ schema }) =>
        schema.type === "array" ? [DEFAULT_UUID] : DEFAULT_UUID,
    },
    {
      pattern: /favorite_artists|artists/i,
      build: ({ schema }) =>
        schema.type === "array" ? ["Legião Urbana", "Queen"] : "Legião Urbana",
    },
    {
      pattern: /^amenities$/i,
      build: () => ["sound_system", "stage", "parking"],
    },
    { pattern: /tags/i, build: () => ["ao-vivo", "cover"] },
    { pattern: /username|user_name|handle/i, build: () => "soundmeet_user" },
    { pattern: /slug/i, build: () => "perfil-do-musico" },
    { pattern: /title|titulo/i, build: () => "Título de exemplo" },
    { pattern: /message|mensagem/i, build: () => "Mensagem de exemplo" },
    { pattern: /comment|comentario/i, build: () => "Comentário de exemplo" },
    {
      pattern: /^status$/i,
      build: ({ schema }) => schema.enum?.[0] ?? "scheduled",
    },
    { pattern: /^notes$/i, build: () => "string" },
    { pattern: /^subject$/i, build: () => "string" },
    { pattern: /^reason$/i, build: () => "string" },
    { pattern: /^establishment_type$/i, build: () => "bar" },
    { pattern: /^role$/i, build: () => "member" },
    { pattern: /^type$/i, build: () => "bar" },
    { pattern: /profile_visibility/i, build: () => "public" },
    {
      pattern: /new_badges/i,
      build: ({ schema }) =>
        schema.type === "array" ? ["Iniciante", "Apoiador"] : "Iniciante",
    },
    {
      pattern: /new_level/i,
      build: ({ schema }) => (schema.type === "number" ? 2 : "2"),
    },
    { pattern: /pix/i, build: () => "chave-pix-exemplo" },
    { pattern: /instagram/i, build: () => "@soundmeet" },
    { pattern: /tiktok/i, build: () => "@soundmeet" },
    { pattern: /youtube/i, build: () => "https://youtube.com/@soundmeet" },
    { pattern: /spotify/i, build: () => "https://open.spotify.com/artist/123" },
    { pattern: /website|site/i, build: () => "https://soundmeet.app" },
    { pattern: /payment_method|paymentmethod/i, build: () => "pix" },
    {
      pattern: /metadata/i,
      build: ({ schema }) =>
        schema.type === "object"
          ? { client: "swagger", platform: "web" }
          : '{"client":"swagger","platform":"web"}',
    },
    { pattern: /^source$/i, build: () => "cifra_club" },
    { pattern: /^key$/i, build: () => "C" },
    { pattern: /cpf/i, build: () => "123.456.789-09" },
    { pattern: /cnpj/i, build: () => "12.345.678/0001-99" },
    { pattern: /zip|cep/i, build: () => "01001-000" },
    { pattern: /city|cidade/i, build: () => "São Paulo" },
    { pattern: /state|estado/i, build: () => "SP" },
    { pattern: /country|pais/i, build: () => "Brasil" },
    { pattern: /address|endereco/i, build: () => "Av. Paulista, 1000" },
    { pattern: /complement|complemento/i, build: () => "Apto 101" },
    { pattern: /number|numero/i, build: () => "1000" },
    { pattern: /neighborhood|bairro/i, build: () => "Bela Vista" },
    { pattern: /url|link/i, build: () => "https://example.com" },
    {
      pattern: /avatar|photo|image/i,
      build: () => "https://example.com/avatar.png",
    },
    { pattern: /name|nome/i, build: () => "Fulano de Tal" },
    {
      pattern: /description|descricao|bio/i,
      build: () => "Descrição de exemplo",
    },
    { pattern: /bpm/i, build: () => 120 },
    { pattern: /difficulty/i, build: () => 3 },
    { pattern: /covercharge|cover_charge/i, build: () => 20 },
    { pattern: /capacity|maxcapacity|max_capacity/i, build: () => 150 },
    { pattern: /rating/i, build: () => 4.7 },
    { pattern: /lat|latitude/i, build: () => -23.561684 },
    { pattern: /lng|longitude|address_long/i, build: () => -46.625378 },
    { pattern: /qr/i, build: () => "qrcode_example_value" },
    { pattern: /_id$/i, build: () => DEFAULT_UUID },
    { pattern: /^id$/i, build: () => DEFAULT_UUID },
  ];
}

export function applySwaggerExamples(
  document: any,
  opts?: Partial<ApplySwaggerExamplesOptions>,
) {
  const isProd = process.env.NODE_ENV === "production";
  const enabled =
    !isProd && process.env.SWAGGER_EXAMPLES_ENABLED?.toLowerCase() !== "false";

  const options: ApplySwaggerExamplesOptions = {
    enabled: opts?.enabled ?? enabled,
    includeOptionalProperties:
      opts?.includeOptionalProperties ??
      process.env.SWAGGER_EXAMPLES_REQUIRED_ONLY?.toLowerCase() !== "true",
    registry: opts?.registry ?? defaultSwaggerExampleRegistry(),
  };

  if (!options.enabled) return;

  const schemas: Record<string, OpenApiSchema> | undefined =
    document?.components?.schemas;
  if (!schemas) return;

  renamePaginationPresenterToMeta(schemas);

  const seen = new Set<string>();
  for (const [name, schema] of Object.entries(schemas)) {
    ensureSchemaExamples(name, schema, schemas, seen, options);
  }
}
