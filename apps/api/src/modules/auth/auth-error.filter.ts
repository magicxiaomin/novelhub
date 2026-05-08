import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

import { AuthError } from './auth.errors';

@Catch(AuthError)
export class AuthErrorFilter implements ExceptionFilter {
  catch(exception: AuthError, host: ArgumentsHost): never {
    void host;
    switch (exception.status) {
      case 400:
        throw new BadRequestException(exception.message);
      case 401:
        throw new UnauthorizedException(exception.message);
      case 409:
        throw new ConflictException(exception.message);
      case 500:
        throw new InternalServerErrorException(exception.message);
    }
  }
}
