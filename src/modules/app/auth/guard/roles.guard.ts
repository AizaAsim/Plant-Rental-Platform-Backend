import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from "@nestjs/common";
import { Reflector } from "@nestjs/core";
import { UserRole } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class RolesGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private prisma: PrismaService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredRoles = this.reflector.getAllAndOverride<UserRole[]>("roles", [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!requiredRoles) {
      return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException("User not authenticated");
    }

    // Get user from database to check role
    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: { role: true },
    });

    if (!dbUser) {
      throw new ForbiddenException("User not found");
    }

    const hasRole = requiredRoles.some((role) => dbUser.role === role);

    if (!hasRole) {
      throw new ForbiddenException("Insufficient permissions");
    }

    return true;
  }
}
