import { HttpStatus, Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "src/prisma/prisma.service";
import { contractOk, contractPublicId, contractFail } from "src/common/contract/response";
import { ContractErrorCode } from "src/common/contract/error-codes";
import type { VendorPackage, VendorPackagePlant, Plant, PlantImage } from "@prisma/client";
import type {
  CreateVendorPackageDto,
  VendorPackagePlantLineDto,
} from "./dto/vendor-package.dto";

type PackageWithPlants = VendorPackage & {
  plants: (VendorPackagePlant & {
    plant: Plant & { images: PlantImage[] };
  })[];
};

@Injectable()
export class VendorPackagesService {
  constructor(private readonly prisma: PrismaService) {}

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
      include: {
        plants: {
          include: {
            plant: {
              include: { images: { where: { isPrimary: true }, take: 1 } },
            },
          },
        },
      },
    });
  }

  private normalizePlantLines(body: {
    plants?: VendorPackagePlantLineDto[];
    plant_ids?: string[];
  }): { plant_id: string; quantity: number }[] | undefined {
    if (body.plants?.length) {
      return body.plants.map((p) => ({
        plant_id: p.plant_id,
        quantity: p.quantity != null ? Number(p.quantity) : 1,
      }));
    }
    if (body.plant_ids?.length) {
      return body.plant_ids.map((id) => ({ plant_id: id, quantity: 1 }));
    }
    return undefined;
  }

  private async validateAndResolvePlants(
    nurseryId: string,
    lines: { plant_id: string; quantity: number }[]
  ) {
    if (!lines.length) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "At least one plant is required",
        HttpStatus.BAD_REQUEST
      );
    }
    const ids = [...new Set(lines.map((l) => l.plant_id))];
    if (ids.length !== lines.length) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "Duplicate plant_id entries are not allowed",
        HttpStatus.BAD_REQUEST
      );
    }
    const plants = await this.prisma.plant.findMany({
      where: { id: { in: ids }, nurseryId, isActive: true },
      select: { id: true },
    });
    if (plants.length !== ids.length) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "All plants must belong to your nursery and be active",
        HttpStatus.BAD_REQUEST
      );
    }
    return lines;
  }

  private async syncPackagePlants(
    packageId: string,
    nurseryId: string,
    lines: { plant_id: string; quantity: number }[]
  ) {
    await this.validateAndResolvePlants(nurseryId, lines);
    await this.prisma.$transaction([
      this.prisma.vendorPackagePlant.deleteMany({ where: { packageId } }),
      ...lines.map((line) =>
        this.prisma.vendorPackagePlant.create({
          data: {
            packageId,
            plantId: line.plant_id,
            quantity: line.quantity,
          },
        })
      ),
    ]);
  }

  private packageHasInStockPlants(row: PackageWithPlants): boolean {
    if (!row.plants.length) return true;
    return row.plants.some((pp) => pp.plant.stockQuantity > 0);
  }

  private plantLineDto(
    pp: VendorPackagePlant & { plant: Plant & { images: PlantImage[] } }
  ) {
    return {
      plant_id: pp.plantId,
      quantity: pp.quantity,
      name: pp.plant.name,
      stock_quantity: pp.plant.stockQuantity,
      stock_status: pp.plant.stockQuantity > 0 ? "AVAILABLE" : "OUT_OF_STOCK",
      image_url: pp.plant.images[0]?.imageUrl ?? null,
    };
  }

  private toDto(row: PackageWithPlants) {
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
      delivery_slots: row.deliverySlots,
      plants: row.plants.map((pp) => this.plantLineDto(pp)),
      is_active: row.isActive,
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }

  private async loadPackageDto(packageId: string) {
    const row = await this.prisma.vendorPackage.findUnique({
      where: { id: packageId },
      include: {
        plants: {
          include: {
            plant: {
              include: { images: { where: { isPrimary: true }, take: 1 } },
            },
          },
        },
      },
    });
    if (!row) {
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Package not found", HttpStatus.NOT_FOUND);
    }
    return this.toDto(row);
  }

  async create(vendorId: string, body: CreateVendorPackageDto) {
    const nursery = await this.nurseryForVendor(vendorId);
    const plantLines = this.normalizePlantLines(body);

    const row = await this.prisma.vendorPackage.create({
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
        deliverySlots:
          body.delivery_slots != null ? (body.delivery_slots as Prisma.InputJsonValue) : undefined,
        isActive: body.is_active !== false,
      },
    });

    if (plantLines?.length) {
      await this.syncPackagePlants(row.id, nursery.id, plantLines);
    }

    return contractOk(await this.loadPackageDto(row.id));
  }

  async list(vendorId: string, isActive?: boolean) {
    const nursery = await this.nurseryForVendor(vendorId);
    const rows = await this.prisma.vendorPackage.findMany({
      where: {
        nurseryId: nursery.id,
        ...(isActive === undefined ? {} : { isActive }),
      },
      include: {
        plants: {
          include: {
            plant: {
              include: { images: { where: { isPrimary: true }, take: 1 } },
            },
          },
        },
      },
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

    const plantLines = this.normalizePlantLines(
      body as unknown as { plants?: VendorPackagePlantLineDto[]; plant_ids?: string[] }
    );

    const row = await this.prisma.vendorPackage.update({
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
        ...(body.delivery_slots !== undefined && {
          deliverySlots: body.delivery_slots as Prisma.InputJsonValue,
        }),
        ...(body.is_active !== undefined && { isActive: Boolean(body.is_active) }),
      },
    });

    if (plantLines !== undefined) {
      await this.syncPackagePlants(row.id, nursery.id, plantLines);
    }

    return contractOk(await this.loadPackageDto(row.id));
  }

  async setPackagePlants(
    vendorId: string,
    packageRef: string,
    body: { plants?: VendorPackagePlantLineDto[]; plant_ids?: string[] }
  ) {
    const nursery = await this.nurseryForVendor(vendorId);
    const existing = await this.packageForNursery(nursery.id, packageRef);
    if (!existing)
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Package not found", HttpStatus.NOT_FOUND);

    const plantLines = this.normalizePlantLines(body);
    if (!plantLines?.length) {
      throw contractFail(
        ContractErrorCode.VALIDATION_ERROR,
        "plants or plant_ids is required",
        HttpStatus.BAD_REQUEST
      );
    }
    await this.syncPackagePlants(existing.id, nursery.id, plantLines);
    const dto = await this.loadPackageDto(existing.id);
    return contractOk({
      package_id: dto.package_id,
      plant_ids: dto.plants.map((p) => p.plant_id),
      plants: dto.plants,
      updated_at: dto.updated_at,
    });
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

  /** Customer-facing: active packages with at least one in-stock assigned plant. */
  async listPublicCatalogueForNursery(nurseryId: string) {
    const nursery = await this.prisma.nursery.findFirst({
      where: { id: nurseryId, isActive: true },
      select: { id: true, name: true, slug: true },
    });
    if (!nursery)
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Nursery not found", HttpStatus.NOT_FOUND);

    const rows = await this.prisma.vendorPackage.findMany({
      where: { nurseryId: nursery.id, isActive: true },
      include: {
        plants: {
          include: {
            plant: {
              include: { images: { where: { isPrimary: true }, take: 1 } },
            },
          },
        },
      },
      orderBy: { createdAt: "desc" },
    });

    const inStockPackages = rows.filter((r) => this.packageHasInStockPlants(r));

    return contractOk({
      nursery: { id: nursery.id, name: nursery.name, slug: nursery.slug },
      items: inStockPackages.map((r) => this.toDto(r)),
    });
  }

  async listAvailablePlantsForPackage(
    nurseryId: string,
    packageRef: string,
    includeOutOfStock = false
  ) {
    const nursery = await this.prisma.nursery.findFirst({
      where: { id: nurseryId, isActive: true },
      select: { id: true },
    });
    if (!nursery)
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Nursery not found", HttpStatus.NOT_FOUND);

    const pkg = await this.prisma.vendorPackage.findFirst({
      where: {
        nurseryId: nursery.id,
        isActive: true,
        OR: [{ id: packageRef }, { publicId: packageRef }],
      },
      include: {
        plants: {
          include: {
            plant: {
              include: { images: { where: { isPrimary: true }, take: 1 } },
            },
          },
        },
      },
    });
    if (!pkg)
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Package not found", HttpStatus.NOT_FOUND);

    let plants = pkg.plants.map((pp) => this.plantLineDto(pp));
    if (!includeOutOfStock) {
      plants = plants.filter((p) => p.stock_quantity > 0);
    }

    return contractOk({
      package_id: pkg.publicId,
      plants: plants.map(({ plant_id, name, image_url, stock_quantity, stock_status }) => ({
        plant_id,
        name,
        image_url,
        stock_quantity,
        stock_status,
      })),
    });
  }
}
