import { HttpException, HttpStatus } from "@nestjs/common";
import { ContractErrorCodeType } from "./error-codes";

export function contractOk<T>(data: T, message?: string) {
  return {
    success: true as const,
    data,
    ...(message ? { message } : {}),
  };
}

export function contractFail(
  code: ContractErrorCodeType,
  message: string,
  status: HttpStatus = HttpStatus.BAD_REQUEST
) {
  return new HttpException(
    {
      success: false,
      error: { code, message },
    },
    status
  );
}

export function contractPublicId(prefix: string): string {
  const n = Math.random().toString(36).slice(2, 10).toUpperCase();
  return `${prefix}-${n}`;
}
