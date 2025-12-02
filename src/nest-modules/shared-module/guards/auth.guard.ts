import {
  Injectable,
  CanActivate,
  ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";
import { Observable } from "rxjs";

@Injectable()
export class AuthGuard implements CanActivate {
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();

    // For now, just check if there's an authorization header
    // This should be replaced with proper JWT validation
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedException("No authorization header found");
    }

    // Basic validation - should be replaced with JWT verification
    if (!authHeader.startsWith("Bearer ")) {
      throw new UnauthorizedException("Invalid authorization header format");
    }

    return true;
  }
}
