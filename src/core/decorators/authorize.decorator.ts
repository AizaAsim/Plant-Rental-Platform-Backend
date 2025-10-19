import { applyDecorators, SetMetadata } from "@nestjs/common";
import { ApiSecurity } from "@nestjs/swagger";

export const Authorized = (roleOrRoles?: any | Array<any>) => {
  let authorizedRoles = [];
  if (roleOrRoles)
    authorizedRoles = Array.isArray(roleOrRoles) ? roleOrRoles : [roleOrRoles];
  return applyDecorators(
    SetMetadata("roles", authorizedRoles),
    SetMetadata("authorization", true),
    ApiSecurity("authorization")
  );
};
