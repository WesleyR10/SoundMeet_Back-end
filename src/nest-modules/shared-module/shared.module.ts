import { Global, Module } from "@nestjs/common";
import { EventEmitterModule } from "@nestjs/event-emitter";

// Services
import { UnitOfWorkService } from "./services/unit-of-work.service";
import { DomainEventService } from "./services/domain-event.service";
import { StorageService } from "./services/storage.service";
import { QRCodeService } from "./services/qrcode.service";
import { NotificationService } from "./services/notification.service";
import { ValidationService } from "./services/validation.service";
import { CacheService } from "./services/cache.service";
import { FileUploadService } from "./services/file-upload.service";
import { ExternalApiService } from "./services/external-api.service";

// Guards
import { AuthGuard } from "./guards/auth.guard";
import { RolesGuard } from "./guards/roles.guard";
import { ThrottlerGuard } from "./guards/throttler.guard";

// Interceptors
import { LoggingInterceptor } from "./interceptors/logging.interceptor";
import { TransformInterceptor } from "./interceptors/transform.interceptor";
import { ErrorInterceptor } from "./interceptors/error.interceptor";

// Filters
import { AllExceptionsFilter } from "./filters/all-exceptions.filter";
import { ValidationExceptionFilter } from "./filters/validation-exception.filter";
import { DomainExceptionFilter } from "./filters/domain-exception.filter";

// Pipes
import { ValidationPipe } from "./pipes/validation.pipe";
import { ParseUuidPipe } from "./pipes/parse-uuid.pipe";

@Global()
@Module({
  imports: [EventEmitterModule],
  providers: [
    // Services
    UnitOfWorkService,
    DomainEventService,
    StorageService,
    QRCodeService,
    NotificationService,
    ValidationService,
    CacheService,
    FileUploadService,
    ExternalApiService,

    // Guards
    AuthGuard,
    RolesGuard,
    ThrottlerGuard,

    // Interceptors
    LoggingInterceptor,
    TransformInterceptor,
    ErrorInterceptor,

    // Filters
    AllExceptionsFilter,
    ValidationExceptionFilter,
    DomainExceptionFilter,

    // Pipes
    ValidationPipe,
    ParseUuidPipe,
  ],
  exports: [
    // Services
    UnitOfWorkService,
    DomainEventService,
    StorageService,
    QRCodeService,
    NotificationService,
    ValidationService,
    CacheService,
    FileUploadService,
    ExternalApiService,

    // Guards
    AuthGuard,
    RolesGuard,
    ThrottlerGuard,

    // Interceptors
    LoggingInterceptor,
    TransformInterceptor,
    ErrorInterceptor,

    // Filters
    AllExceptionsFilter,
    ValidationExceptionFilter,
    DomainExceptionFilter,

    // Pipes
    ValidationPipe,
    ParseUuidPipe,
  ],
})
export class SharedModule {}
