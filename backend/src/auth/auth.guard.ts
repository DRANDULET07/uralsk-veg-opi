import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { AuthService, AuthUser } from './auth.service';

type RequestWithUser = {
  headers: {
    authorization?: string;
  };
  user?: AuthUser;
};

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private readonly authService: AuthService) {}

  async canActivate(context: ExecutionContext) {
    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const authorization = request.headers.authorization;

    if (!authorization) {
      throw new UnauthorizedException('Authorization header is required');
    }

    const [scheme, token] = authorization.split(' ');

    if (scheme !== 'Bearer' || !token || authorization.split(' ').length !== 2) {
      throw new UnauthorizedException(
        'Authorization header must use Bearer token',
      );
    }

    request.user = await this.authService.verifyToken(token);

    return true;
  }
}
