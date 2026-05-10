// src/modules/app/users/users.module.ts
import { Module } from "@nestjs/common";
import { UsersController } from "./users.controller";
import { FavoritesAliasController } from "./favorites-alias.controller";
import { UsersService } from "./users.service";
import { PrismaModule } from "src/prisma/prisma.module";
import { RolesGuard } from "../auth/guard/roles.guard";

@Module({
  imports: [PrismaModule],
  controllers: [UsersController, FavoritesAliasController],
  providers: [UsersService, RolesGuard],
  exports: [UsersService],
})
export class UsersModule {}
