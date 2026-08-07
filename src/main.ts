// Precisa ser o primeiro import do arquivo, antes de @nestjs/core e de
// qualquer módulo da aplicação — ver comentário em instrument.ts.
import "./instrument";

import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";
import { ConfigService } from "@nestjs/config";

import { AppModule } from "./app.module";
import { applyGlobalConfig } from "./nest-modules/global-config";
import { applySwaggerExamples } from "./nest-modules/shared-module/swagger/swagger-examples";
import { RedisIoAdapter } from "./nest-modules/shared-module/websocket/redis-io.adapter";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // CORS Configuration
  app.enableCors({
    origin: [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:8080",
      process.env.FRONTEND_URL as string,
    ].filter((v): v is string => Boolean(v)),
    credentials: true,
  });

  applyGlobalConfig(app);

  // Global Prefix
  app.setGlobalPrefix("api/v1");

  // Swagger Documentation
  let swaggerReady = false;
  try {
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
        persistAuthorization: true,
      },
    });
    swaggerReady = true;
  } catch (error) {
    console.error("❌ Swagger disabled due to error:", error);
  }

  const configService = app.get(ConfigService);
  const redisUrl = configService.get<string>("REDIS_URL") ?? "redis://localhost:6379";
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
