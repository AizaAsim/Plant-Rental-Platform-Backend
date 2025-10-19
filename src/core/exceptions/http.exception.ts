/* eslint-disable @typescript-eslint/no-unused-vars */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-argument */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  BadRequestException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

function _prepareBadRequestValidationErrors(errors) {
  const Errors: any = {};
  for (const err of errors) {
    const constraint =
      err.constraints &&
      Object.values(err.constraints) &&
      Object.values(err.constraints).length &&
      Object.values(err.constraints)[0];
    Errors[err.property] = constraint
      ? constraint
      : `${err.property} is invalid`;
  }
  return Errors;
}

@Catch(HttpException, Error)
export class HttpExceptionFilter implements ExceptionFilter {
  constructor() {}

  catch(exception: HttpException | Error, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response: any = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (!(exception instanceof HttpException)) {
      // Log the error that wasn't an HttpException
      console.error('Non-HTTP Exception caught:', exception);

      const ResponseToSend = {
        message: 'Something went wrong',
      };
      response.__ss_body = ResponseToSend;
      response.status(HttpStatus.INTERNAL_SERVER_ERROR).json(ResponseToSend);
      return;
    }

    const status = exception.getStatus();
    const exceptionResponse: any = exception.getResponse();

    if (
      exception instanceof BadRequestException &&
      exceptionResponse.message &&
      Array.isArray(exceptionResponse.message)
    ) {
      const ResponseToSend = {
        message: `Invalid values: ${exceptionResponse.message.map((x) => x.property).join(', ')}`,
        errors: _prepareBadRequestValidationErrors(exceptionResponse.message),
      };
      response.__ss_body = ResponseToSend;
      response.status(status).json(ResponseToSend);
    } else {
      // Get the error message from the exception response
      const errorMessage = this.getErrorMessage(
        exceptionResponse.key || exceptionResponse.message,
        exceptionResponse.message,
      );

      const ResponseToSend = {
        message: errorMessage,
        data: exceptionResponse?.data || undefined,
      };
      response.__ss_body = ResponseToSend;
      response.status(status).json(ResponseToSend);
    }
  }

  private getErrorMessage(errorKey: string, originalMessage?: string): string {
    // First try to use the original message if it looks like a proper error message
    if (
      originalMessage &&
      typeof originalMessage === 'string' &&
      !originalMessage.includes('.')
    ) {
      return originalMessage;
    }

    // Extract the error type for pattern matching
    const keyPart = errorKey?.toLowerCase() || '';

    if (keyPart.includes('email_already_exist')) {
      return 'User with this email already exists';
    } else if (keyPart.includes('username_already_exist')) {
      return 'User with this username already exists';
    } else if (keyPart.includes('invalid_credentials')) {
      return 'Invalid credentials';
    } else if (keyPart.includes('unauthorized')) {
      return 'Unauthorized resource';
    } else if (keyPart.includes('not_found')) {
      return 'Resource not found';
    } else if (keyPart.includes('forbidden')) {
      return 'Access not allowed';
    } else if (keyPart.includes('fatal')) {
      return 'Something went wrong';
    } else if (keyPart.includes('bad_request')) {
      return 'Bad request';
    } else if (keyPart.includes('invalid_token')) {
      return 'Invalid or expired token';
    } else if (keyPart.includes('invalid_verification_code')) {
      return 'Invalid verification code';
    } else if (keyPart.includes('phone_number_already_exist')) {
      return 'Phone number already exists';
    } else if (keyPart.includes('invalid_values')) {
      return 'Invalid input values provided';
    }

    return 'An error occurred';
  }
}
