import { NestFactory } from "@nestjs/core";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module";
import { applyGlobalConfig } from "./nest-modules/global-config";
import { applySwaggerExamples } from "./nest-modules/shared-module/swagger/swagger-examples";

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
    .addTag("Musicians", "Gestão de músicos")
    .addTag("Bands", "Gestão de bandas")
    .addTag("Establishments", "Gestão de estabelecimentos")
    .addTag("Audience", "Gestão do público")
    .addTag("Requests", "Pedidos musicais")
    .addTag("Gamification", "Sistema de gamificação")
    .addTag("Payments", "Pagamentos e gorjetas")
    .build();

  const document = SwaggerModule.createDocument(app, config);
  applySwaggerExamples(document);
  SwaggerModule.setup("api/docs", app, document, {
    swaggerOptions: {
      persistAuthorization: true,
    },
  });

  const port = process.env.PORT || 3000;
  await app.listen(port, "0.0.0.0");

  console.log(`🚀 SoundMeet API is running on: http://localhost:${port}`);
  console.log(`📚 Swagger documentation: http://localhost:${port}/api/docs`);
}

bootstrap().catch((error) => {
  console.error("❌ Error starting the application:", error);
  process.exit(1);
});
