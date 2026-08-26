// Precisa ser o primeiro import do arquivo, antes de @nestjs/core e de
// qualquer módulo da aplicação — ver comentário em instrument.ts.
import "./instrument";

import { ConfigService } from "@nestjs/config";
import { NestFactory } from "@nestjs/core";
import { NestExpressApplication } from "@nestjs/platform-express";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import helmet from "helmet";

import { AppModule } from "./app.module";
import { applyGlobalConfig } from "./nest-modules/global-config";
import { resolveHttpSecurityPolicy } from "./nest-modules/shared-module/security/http-security.policy";
import { applySwaggerExamples } from "./nest-modules/shared-module/swagger/swagger-examples";
import { RedisIoAdapter } from "./nest-modules/shared-module/websocket/redis-io.adapter";

/** Sinaliza desligamento deliberado — distinto de uma falha ao montar. */
class SwaggerDisabled extends Error {}

async function bootstrap() {
  const app = await NestFactory.create<NestExpressApplication>(AppModule);

  /*
   * ⚠️ Express 5 trocou o parser de query padrão de "extended" (qs) para
   * "simple" (querystring do Node), que NÃO monta objeto aninhado.
   *
   * Sem esta linha, `?filter[status]=active` chega em `req.query` como a chave
   * literal `"filter[status]"`; o `filter` do DTO fica `undefined` e o
   * `whitelist: true` do ValidationPipe descarta a chave estranha. Resultado:
   * TODA busca com filtro aninhado da API respondia 200 com a lista INTEIRA,
   * sem nenhum erro — falha silenciosa em `GET /musicians`, `GET
   * /establishments/:id/events`, bookings, inquiries e na busca por raio
   * (`filter[lat]/[lng]/[radius_km]`), que devolveria o país todo em vez do
   * bairro.
   *
   * Verificado por HTTP em 08/ago/2026: `filter[status]=cancelled` devolvia o
   * evento `active`, e `filter[name]=zzz` devolvia todos os músicos.
   *
   * Os testes unitários não pegavam porque montam `SearchParams` com objeto já
   * pronto, pulando a fronteira HTTP — exatamente como o 422 de data dos DTOs
   * de evento (ver `create-event.input.ts`).
   */
  app.set("query parser", "extended");

  const configService = app.get(ConfigService);

  /*
   * SM-020 — quem pode chamar a API, se o contrato é público e o que o
   * navegador aceita executar. As três decisões vivem em `http-security.policy`,
   * não aqui: `bootstrap()` é o único ponto do sistema que nenhum teste
   * alcança, e era exatamente onde a allowlist de CORS estava escrita à mão.
   */
  const security = resolveHttpSecurityPolicy({
    node_env: configService.get<string>("NODE_ENV"),
    cors_allowed_origins: configService.get<string>("CORS_ALLOWED_ORIGINS"),
    frontend_url: process.env.FRONTEND_URL,
    swagger_enabled: configService.get<boolean>("SWAGGER_ENABLED"),
  });

  app.enableCors({ origin: security.corsOrigins, credentials: true });
  app.use(helmet(security.helmet));

  applyGlobalConfig(app);

  // Global Prefix
  app.setGlobalPrefix("api/v1");

  /*
   * SM-020 — a documentação só é montada quando `SWAGGER_ENABLED` permite.
   *
   * Sem o gate, `/api/docs` publicava o contrato inteiro da API em produção,
   * com `persistAuthorization: true` guardando o token digitado no
   * `localStorage` do navegador — conveniência de desenvolvimento que, numa
   * máquina compartilhada ou num navegador com extensão hostil, vira token de
   * produção parado no disco. Desligado, o `setup` nem chega a rodar e a rota
   * responde 404 como qualquer caminho inexistente.
   */
  let swaggerReady = false;
  try {
    if (!security.swaggerEnabled) {
      throw new SwaggerDisabled();
    }
    const config = new DocumentBuilder()
      .setTitle("SoundMeet API")
      .setDescription("API da plataforma SoundMeet - Conexão Musical")
      .setVersion("1.0")
      .addBearerAuth(
        {
          type: "http",
          scheme: "bearer",
          bearerFormat: "JWT",
          name: "JWT",
          description: "Enter JWT token",
          in: "header",
        },
        "JWT-auth",
      )
      .addTag("Auth", "Autenticação e autorização")
      .addTag("Audience", "Gestão do público")
      .addTag("Bands", "Gestão de bandas")
      .addTag("Musicians", "Gestão de músicos")
      .addTag("Scheduling", "Agenda e bookings")
      .addTag("Establishments", "Gestão de estabelecimentos")
      .addTag("Requests", "Pedidos musicais")
      .addTag("Events", "Gestão de eventos")
      .addTag("Gamification", "Sistema de gamificação")
      .addTag("Payments", "Pagamentos e gorjetas")
      .addTag("Plans", "Catálogo de planos e assinaturas recorrentes")
      .addTag("Music Library", "Catalogo musical canonico")
      .addTag("AI Cifra", "Análise de cifra (BPM, tom, acordes, estrutura)")
      .addTag("AI Audio", "Separacao e processamento de audio")
      .addTag("SyncedLyrics", "Letras sincronizadas e folhas de cifra")
      .build();

    const document = SwaggerModule.createDocument(app, config);
    applySwaggerExamples(document);
    SwaggerModule.setup("api/docs", app, document, {
      swaggerOptions: {
        // Guarda o token no localStorage do navegador. Aceitável só porque
        // este bloco nunca roda com `SWAGGER_ENABLED=false`, que é o padrão
        // em produção.
        persistAuthorization: true,
      },
    });
    swaggerReady = true;
  } catch (error) {
    if (error instanceof SwaggerDisabled) {
      console.log("📕 Swagger disabled by configuration (SWAGGER_ENABLED)");
    } else {
      console.error("❌ Swagger disabled due to error:", error);
    }
  }

  const redisUrl =
    configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";
  const redisIoAdapter = new RedisIoAdapter(app, redisUrl);
  await redisIoAdapter.connect();
  app.useWebSocketAdapter(redisIoAdapter);

  const port = process.env.PORT || 3000;
  await app.listen(port, "0.0.0.0");

  console.log(`🚀 SoundMeet API is running on: http://localhost:${port}`);
  if (swaggerReady) {
    console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
  }
}

bootstrap().catch((error) => {
  console.error("❌ Error starting the application:", error);
  process.exit(1);
});
