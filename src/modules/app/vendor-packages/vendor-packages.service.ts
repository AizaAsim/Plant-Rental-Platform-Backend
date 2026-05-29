import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "src/prisma/prisma.service";
import { contractOk, contractPublicId, contractFail } from "src/common/contract/response";
import { ContractErrorCode } from "src/common/contract/error-codes";
import { HttpStatus } from "@nestjs/common";
import type { VendorPackage, VendorPackagePlant } from "@prisma/client";
import type { CreateVendorPackageDto, VendorPackagePlantLineDto } from "./dto/vendor-package.dto";

type PackagePlantRow = VendorPackagePlant & {
  plant: {
    id: string;
    name: string;
    stockQuantity: number;
    isActive: boolean;
    images?: { imageUrl: string }[];
  };
};

@Injectable()
export class VendorPackagesService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly packagePlantInclude = {
    plants: {
      include: {
        plant: {
          select: {
            id: true,
            name: true,
            stockQuantity: true,
            isActive: true,
            images: { where: { isPrimary: true }, take: 1 },
          },
        },
      },
    },
  } satisfies Prisma.VendorPackageInclude;

  private async nurseryForVendor(vendorId: string) {
    const n = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!n)
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Nursery not found", HttpStatus.NOT_FOUND);
    return n;
  }

  /** Resolve by internal UUID or by contract public_id (e.g. VPkg-xxxxxxxx). */
  private async packageForNursery(nurseryInternalId: string, packageRef: string) {
    return this.prisma.vendorPackage.findFirst({
      where: {
        nurseryId: nurseryInternalId,
        OR: [{ id: packageRef }, { publicId: packageRef }],
      },
      include: this.packagePlantInclude,
    });
  }

  private async validatePlantLines(nurseryId: string, plants?: VendorPackagePlantLineDto[]) {
    if (!plants?.length) return;
    const ids = [...new Set(plants.map((p) => p.plant_id))];
    const rows = await this.prisma.plant.findMany({
      where: { id: { in: ids }, nurseryId, isActive: true },
      select: { id: true, name: true },
    });
    if (rows.length !== ids.length) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "One or more plants are invalid or belong to another nursery",
        HttpStatus.BAD_REQUEST
      );
    }
  }

  private async syncPackagePlants(
    tx: Prisma.TransactionClient,
    packageId: string,
    nurseryId: string,
    plants?: VendorPackagePlantLineDto[]
  ) {
    if (plants === undefined) return;
    await this.validatePlantLines(nurseryId, plants);
    await tx.vendorPackagePlant.deleteMany({ where: { packageId } });
    if (plants.length === 0) return;
    await tx.vendorPackagePlant.createMany({
      data: plants.map((p) => ({
        packageId,
        plantId: p.plant_id,
        quantity: p.quantity,
      })),
    });
  }

  private packageHasStock(plants: PackagePlantRow[]): boolean {
    if (plants.length === 0) return true;
    return plants.every((row) => row.plant.isActive && row.plant.stockQuantity >= row.quantity);
  }

  async create(vendorId: string, body: CreateVendorPackageDto) {
    const nursery = await this.nurseryForVendor(vendorId);
    await this.validatePlantLines(nursery.id, body.plants);

    const row = await this.prisma.$transaction(async (tx) => {
      const pkg = await tx.vendorPackage.create({
        data: {
          publicId: contractPublicId("VPkg"),
          nurseryId: nursery.id,
          name: body.name,
          tier: body.tier,
          description: body.description != null ? body.description : null,
          maxPlantCount: body.max_plant_count,
          rentalDurationDays: body.rental_duration_days,
          includesMaintenance: body.includes_maintenance,
          maintenanceVisitsPerMonth: body.maintenance_visits_per_month ?? 0,
          basePrice: new Decimal(String(body.base_price)),
          depositAmount: new Decimal(String(body.deposit_amount ?? 0)),
          allowsInstallments: Boolean(body.allows_installments),
          installmentOptions:
            body.installment_options != null ? (body.installment_options as Prisma.InputJsonValue) : undefined,
          addOns: body.add_ons != null ? (body.add_ons as Prisma.InputJsonValue) : undefined,
          isActive: body.is_active !== false,
        },
      });
      await this.syncPackagePlants(tx, pkg.id, nursery.id, body.plants);
      return tx.vendorPackage.findUniqueOrThrow({
        where: { id: pkg.id },
        include: this.packagePlantInclude,
      });
    });
    return contractOk(this.toDto(row));
  }

  async list(vendorId: string, isActive?: boolean) {
    const nursery = await this.nurseryForVendor(vendorId);
    const rows = await this.prisma.vendorPackage.findMany({
      where: {
        nurseryId: nursery.id,
        ...(isActive === undefined ? {} : { isActive }),
      },
      include: this.packagePlantInclude,
      orderBy: { createdAt: "desc" },
    });
    return contractOk({ items: rows.map((r) => this.toDto(r)) });
  }

  async getOne(vendorId: string, packageRef: string) {
    const nursery = await this.nurseryForVendor(vendorId);
    const existing = await this.packageForNursery(nursery.id, packageRef);
    if (!existing)
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Package not found", HttpStatus.NOT_FOUND);
    return contractOk(this.toDto(existing));
  }

  async update(vendorId: string, packageRef: string, body: Record<string, unknown>) {
    const nursery = await this.nurseryForVendor(vendorId);
    const existing = await this.packageForNursery(nursery.id, packageRef);
    if (!existing)
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Package not found", HttpStatus.NOT_FOUND);

    const plantsRaw = body.plants;
    const plants =
      plantsRaw === undefined
        ? undefined
        : (Array.isArray(plantsRaw) ? plantsRaw : []) as VendorPackagePlantLineDto[];

    const row = await this.prisma.$transaction(async (tx) => {
      await tx.vendorPackage.update({
        where: { id: existing.id },
        data: {
          ...(body.name !== undefined && { name: String(body.name) }),
          ...(body.tier !== undefined && { tier: String(body.tier) }),
          ...(body.description !== undefined && {
            description: body.description != null ? String(body.description) : null,
          }),
          ...(body.max_plant_count !== undefined && { maxPlantCount: Number(body.max_plant_count) }),
          ...(body.rental_duration_days !== undefined && { rentalDurationDays: Number(body.rental_duration_days) }),
          ...(body.includes_maintenance !== undefined && { includesMaintenance: Boolean(body.includes_maintenance) }),
          ...(body.maintenance_visits_per_month !== undefined && {
            maintenanceVisitsPerMonth: Number(body.maintenance_visits_per_month),
          }),
          ...(body.base_price !== undefined && { basePrice: new Decimal(String(body.base_price)) }),
          ...(body.deposit_amount !== undefined && { depositAmount: new Decimal(String(body.deposit_amount)) }),
          ...(body.allows_installments !== undefined && { allowsInstallments: Boolean(body.allows_installments) }),
          ...(body.installment_options !== undefined && {
            installmentOptions: body.installment_options as Prisma.InputJsonValue,
          }),
          ...(body.add_ons !== undefined && { addOns: body.add_ons as Prisma.InputJsonValue }),
          ...(body.is_active !== undefined && { isActive: Boolean(body.is_active) }),
        },
      });
      await this.syncPackagePlants(tx, existing.id, nursery.id, plants);
      return tx.vendorPackage.findUniqueOrThrow({
        where: { id: existing.id },
        include: this.packagePlantInclude,
      });
    });
    return contractOk(this.toDto(row));
  }

  async remove(vendorId: string, packageRef: string) {
    const nursery = await this.nurseryForVendor(vendorId);
    const existing = await this.packageForNursery(nursery.id, packageRef);
    if (!existing)
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Package not found", HttpStatus.NOT_FOUND);
    await this.prisma.vendorPackage.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    return contractOk({ package_id: existing.publicId, deactivated: true });
  }

  /** Customer-facing: active packages with sufficient available stock for all allocated plants. */
  async listPublicCatalogueForNursery(nurseryId: string) {
    const nursery = await this.prisma.nursery.findFirst({
      where: { id: nurseryId, isActive: true },
      select: { id: true, name: true, slug: true },
    });
    if (!nursery)
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Nursery not found", HttpStatus.NOT_FOUND);

    const rows = await this.prisma.vendorPackage.findMany({
      where: { nurseryId: nursery.id, isActive: true },
      include: this.packagePlantInclude,
      orderBy: { createdAt: "desc" },
    });

    const inStock = rows.filter((r) => this.packageHasStock(r.plants));

    return contractOk({
      nursery: { id: nursery.id, name: nursery.name, slug: nursery.slug },
      items: inStock.map((r) => this.toDto(r, { publicView: true })),
    });
  }

  private plantLineDto(row: PackagePlantRow) {
    return {
      plant_id: row.plant.id,
      plant_name: row.plant.name,
      quantity: row.quantity,
      available_stock: row.plant.stockQuantity,
      image_url: row.plant.images?.[0]?.imageUrl ?? null,
    };
  }

  private toDto(
    row: VendorPackage & { plants?: PackagePlantRow[] },
    opts?: { publicView?: boolean }
  ) {
    const plants = row.plants ?? [];
    const allocatedCount = plants.reduce((sum, p) => sum + p.quantity, 0);
    return {
      package_id: row.publicId,
      name: row.name,
      tier: row.tier,
      description: row.description,
      max_plant_count: row.maxPlantCount,
      rental_duration_days: row.rentalDurationDays,
      includes_maintenance: row.includesMaintenance,
      maintenance_visits_per_month: row.maintenanceVisitsPerMonth,
      base_price: Number(row.basePrice),
      deposit_amount: Number(row.depositAmount),
      allows_installments: row.allowsInstallments,
      installment_options: row.installmentOptions,
      add_ons: row.addOns,
      is_active: row.isActive,
      plants: plants.map((p) => this.plantLineDto(p)),
      allocated_plant_count: allocatedCount,
      ...(opts?.publicView
        ? { in_stock: this.packageHasStock(plants) }
        : {}),
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
