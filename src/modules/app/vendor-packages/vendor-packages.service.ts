import { Injectable } from "@nestjs/common";
import { Decimal } from "@prisma/client/runtime/library";
import { PrismaService } from "src/prisma/prisma.service";
import { contractOk, contractPublicId, contractFail } from "src/common/contract/response";
import { ContractErrorCode } from "src/common/contract/error-codes";
import { HttpStatus } from "@nestjs/common";

@Injectable()
export class VendorPackagesService {
  constructor(private readonly prisma: PrismaService) {}

  private async nurseryForVendor(vendorId: string) {
    const n = await this.prisma.nursery.findUnique({ where: { vendorId } });
    if (!n) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Nursery not found", HttpStatus.NOT_FOUND);
    return n;
  }

  async create(vendorId: string, body: Record<string, unknown>) {
    const nursery = await this.nurseryForVendor(vendorId);
    const row = await this.prisma.vendorPackage.create({
      data: {
        publicId: contractPublicId("VPkg"),
        nurseryId: nursery.id,
        name: String(body.name ?? ""),
        tier: String(body.tier ?? "BASIC"),
        description: body.description != null ? String(body.description) : null,
        maxPlantCount: Number(body.max_plant_count ?? 0),
        rentalDurationDays: Number(body.rental_duration_days ?? 30),
        includesMaintenance: Boolean(body.includes_maintenance),
        maintenanceVisitsPerMonth: Number(body.maintenance_visits_per_month ?? 0),
        basePrice: new Decimal(String(body.base_price ?? 0)),
        depositAmount: new Decimal(String(body.deposit_amount ?? 0)),
        allowsInstallments: Boolean(body.allows_installments),
        installmentOptions: (body.installment_options as object) ?? undefined,
        addOns: (body.add_ons as object) ?? undefined,
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

  async update(vendorId: string, packageId: string, body: Record<string, unknown>) {
    const nursery = await this.nurseryForVendor(vendorId);
    const existing = await this.prisma.vendorPackage.findFirst({
      where: { id: packageId, nurseryId: nursery.id },
    });
    if (!existing) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Package not found", HttpStatus.NOT_FOUND);
    const row = await this.prisma.vendorPackage.update({
      where: { id: existing.id },
      data: {
        ...(body.name !== undefined && { name: String(body.name) }),
        ...(body.tier !== undefined && { tier: String(body.tier) }),
        ...(body.description !== undefined && { description: body.description != null ? String(body.description) : null }),
        ...(body.max_plant_count !== undefined && { maxPlantCount: Number(body.max_plant_count) }),
        ...(body.rental_duration_days !== undefined && { rentalDurationDays: Number(body.rental_duration_days) }),
        ...(body.includes_maintenance !== undefined && { includesMaintenance: Boolean(body.includes_maintenance) }),
        ...(body.maintenance_visits_per_month !== undefined && {
          maintenanceVisitsPerMonth: Number(body.maintenance_visits_per_month),
        }),
        ...(body.base_price !== undefined && { basePrice: new Decimal(String(body.base_price)) }),
        ...(body.deposit_amount !== undefined && { depositAmount: new Decimal(String(body.deposit_amount)) }),
        ...(body.allows_installments !== undefined && { allowsInstallments: Boolean(body.allows_installments) }),
        ...(body.installment_options !== undefined && { installmentOptions: body.installment_options as object }),
        ...(body.add_ons !== undefined && { addOns: body.add_ons as object }),
        ...(body.is_active !== undefined && { isActive: Boolean(body.is_active) }),
      },
    });
    return contractOk(this.toDto(row));
  }

  async remove(vendorId: string, packageId: string) {
    const nursery = await this.nurseryForVendor(vendorId);
    const existing = await this.prisma.vendorPackage.findFirst({
      where: { id: packageId, nurseryId: nursery.id },
    });
    if (!existing) throw contractFail(ContractErrorCode.RESOURCE_NOT_FOUND, "Package not found", HttpStatus.NOT_FOUND);
    await this.prisma.vendorPackage.update({
      where: { id: existing.id },
      data: { isActive: false },
    });
    return contractOk({ package_id: existing.publicId, deactivated: true });
  }

  private toDto(row: {
    publicId: string;
    name: string;
    tier: string;
    description: string | null;
    maxPlantCount: number;
    rentalDurationDays: number;
    includesMaintenance: boolean;
    maintenanceVisitsPerMonth: number;
    basePrice: Decimal;
    depositAmount: Decimal;
    allowsInstallments: boolean;
    installmentOptions: unknown;
    addOns: unknown;
    isActive: boolean;
  }) {
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
    };
  }
}
