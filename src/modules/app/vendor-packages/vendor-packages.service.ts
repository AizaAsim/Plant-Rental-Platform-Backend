import { Injectable } from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "src/prisma/prisma.service";
import { contractOk, contractPublicId, contractFail } from "src/common/contract/response";
import { ContractErrorCode } from "src/common/contract/error-codes";
import { HttpStatus } from "@nestjs/common";
import type { VendorPackage } from "@prisma/client";
import type { CreateVendorPackageDto } from "./dto/vendor-package.dto";

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
    });
  }

  async create(vendorId: string, body: CreateVendorPackageDto) {
    const nursery = await this.nurseryForVendor(vendorId);
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
        isActive: body.is_active !== false,
      },
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
        ...(body.is_active !== undefined && { isActive: Boolean(body.is_active) }),
      },
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

  /** Customer-facing: active packages only. */
  async listPublicCatalogueForNursery(nurseryId: string) {
    const nursery = await this.prisma.nursery.findFirst({
      where: { id: nurseryId, isActive: true },
      select: { id: true, name: true, slug: true },
    });
    if (!nursery)
      throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Nursery not found", HttpStatus.NOT_FOUND);

    const rows = await this.prisma.vendorPackage.findMany({
      where: { nurseryId: nursery.id, isActive: true },
      orderBy: { createdAt: "desc" },
    });
    return contractOk({
      nursery: { id: nursery.id, name: nursery.name, slug: nursery.slug },
      items: rows.map((r) => this.toDto(r)),
    });
  }

  private toDto(row: VendorPackage) {
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
      created_at: row.createdAt.toISOString(),
      updated_at: row.updatedAt.toISOString(),
    };
  }
}
