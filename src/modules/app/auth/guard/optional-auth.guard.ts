// src/modules/app/auth/guards/optional-auth.guard.ts
import { Injectable } from "@nestjs/common";
import { AuthGuard } from "@nestjs/passport";

@Injectable()
export class OptionalAuthGuard extends AuthGuard("jwt") {
  handleRequest(err: any, user: any) {
    // Return user if authenticated, null otherwise
    return user || null;
  }
}
