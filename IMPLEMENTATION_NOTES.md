# Implementation Notes

## Schema Changes Required

The following models have been added to `schema.prisma`:
- `PlantPackage` - Fixed packages created by admin
- `PlantPackageItem` - Items in a package
- `CustomPlantPackage` - User-customized packages
- `CustomPlantPackageItem` - Items in custom packages
- `CartPackageItem` - Package items in cart

**Important**: Run `npx prisma migrate dev` to apply these schema changes.

## Services to Implement

1. **Plant Service** - Complete rewrite with all endpoints
2. **Package Service** - New service for package/bundle management
3. **Cart Service** - New service for cart operations

All services will be implemented in the next steps.
