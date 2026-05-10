import { Injectable } from "@nestjs/common";
import { PrismaService } from "src/prisma/prisma.service";

export type VendorOnboardingFlowStep = {
  order: number;
  id: string;
  title: string;
  description: string;
  endpoints: { method: string; path: string; notes?: string }[];
};

/** Static map of Phase 00 routes (machine-readable companion to Swagger). */
const CANONICAL_FLOW: VendorOnboardingFlowStep[] = [
  {
    order: 1,
    id: "vendor_auth",
    title: "Vendor account & JWT",
    description: "Obtain bearer token as role VENDOR.",
    endpoints: [
      { method: "POST", path: "/api/v1/auth/register", notes: "include role=VENDOR per DTO" },
      { method: "POST", path: "/api/v1/auth/login" },
      { method: "POST", path: "/api/v1/auth/verify-otp" },
    ],
  },
  {
    order: 2,
    id: "nursery_profile",
    title: "Nursery (vendor) profile",
    description: "Create storefront profile and keep it updated.",
    endpoints: [
      { method: "POST", path: "/api/v1/nurseries", notes: "create once per vendor" },
      { method: "GET", path: "/api/v1/nurseries/my-nursery" },
      { method: "PUT", path: "/api/v1/nurseries/my-nursery" },
    ],
  },
  {
    order: 3,
    id: "service_areas",
    title: "Service areas (pincodes)",
    description: "Where the nursery will deliver or service.",
    endpoints: [
      { method: "PUT", path: "/api/v1/nurseries/my-nursery/service-areas" },
      { method: "GET", path: "/api/v1/nurseries/my-nursery/service-areas" },
      { method: "GET", path: "/api/v1/nurseries/check-serviceability", notes: "public; query nursery_id + pincode" },
    ],
  },
  {
    order: 4,
    id: "working_hours",
    title: "Working hours",
    description: "Weekly schedule for operations/dispatch.",
    endpoints: [
      { method: "PUT", path: "/api/v1/nurseries/my-nursery/working-hours" },
      { method: "GET", path: "/api/v1/nurseries/my-nursery/working-hours" },
    ],
  },
  {
    order: 5,
    id: "media",
    title: "Nursery images",
    description: "Gallery / branding assets.",
    endpoints: [
      { method: "POST", path: "/api/v1/nurseries/my-nursery/images" },
      { method: "DELETE", path: "/api/v1/nurseries/my-nursery/images/:image_id" },
    ],
  },
  {
    order: 6,
    id: "vendor_packages",
    title: "Vendor rental packages",
    description: "Own catalogue tiers (contract / MISS-01).",
    endpoints: [
      { method: "POST", path: "/api/v1/vendor/packages", notes: "VENDOR JWT" },
      { method: "GET", path: "/api/v1/vendor/packages", notes: "?is_active= optional" },
      { method: "GET", path: "/api/v1/vendor/packages/:package_id", notes: "public_id or UUID" },
      { method: "PUT", path: "/api/v1/vendor/packages/:package_id" },
      { method: "DELETE", path: "/api/v1/vendor/packages/:package_id", notes: "soft-deactivate" },
      {
        method: "GET",
        path: "/api/v1/nurseries/:nursery_id/vendor-packages",
        notes: "public catalogue (active packages only)",
      },
    ],
  },
  {
    order: 7,
    id: "vendor_rental_board",
    title: "Vendor rental lifecycle board",
    description:
      "Per–order-item rental buckets (ONGOING, DUE_TODAY, OVERDUE, COMPLETED). Replaces ad-hoc frontend mocks; legacy list under /orders.",
    endpoints: [
      {
        method: "GET",
        path: "/api/v1/vendor/rentals",
        notes:
          "?bucket=ONGOING|DUE_TODAY|OVERDUE|COMPLETED (default ONGOING); response: counts + pagination + items",

      },
      {
        method: "GET",
        path: "/api/v1/orders/vendor/rentals/active",
        notes: "legacy; optional status=DUE_TODAY|OVERDUE",
      },
    ],
  },
  {
    order: 8,
    id: "staff_team",
    title: "Staff gardeners (team accounts)",
    description:
      "Vendor CRUD for nursery-attached staff (aliases under /vendor/staff-gardeners; legacy my-nursery/gardeners). Not the freelance marketplace.",
    endpoints: [
      { method: "POST", path: "/api/v1/vendor/staff-gardeners", notes: "alias" },
      { method: "GET", path: "/api/v1/vendor/staff-gardeners" },
      { method: "GET", path: "/api/v1/vendor/staff-gardeners/:gardener_id" },
      { method: "PUT", path: "/api/v1/vendor/staff-gardeners/:gardener_id" },
      { method: "POST", path: "/api/v1/vendor/staff-gardeners/:gardener_id/reset-credentials" },
      { method: "POST", path: "/api/v1/vendor/staff-gardeners/:gardener_id/status" },
      { method: "POST", path: "/api/v1/vendor/staff-gardeners/:gardener_id/invite" },
      { method: "GET", path: "/api/v1/vendor/staff-gardeners/invitations/sent" },
      { method: "DELETE", path: "/api/v1/vendor/staff-gardeners/:gardener_id" },
      { method: "POST", path: "/api/v1/nurseries/my-nursery/gardeners", notes: "legacy" },
      { method: "GET", path: "/api/v1/nurseries/my-nursery/gardeners" },
      { method: "GET", path: "/api/v1/nurseries/my-nursery/gardeners/:gardener_id" },
      { method: "PUT", path: "/api/v1/nurseries/my-nursery/gardeners/:gardener_id" },
      { method: "POST", path: "/api/v1/nurseries/my-nursery/gardeners/:gardener_id/reset-credentials" },
      { method: "POST", path: "/api/v1/nurseries/my-nursery/gardeners/:gardener_id/status" },
      { method: "POST", path: "/api/v1/nurseries/my-nursery/gardeners/:gardener_id/invite" },
      { method: "GET", path: "/api/v1/nurseries/my-nursery/invitations" },
      { method: "DELETE", path: "/api/v1/nurseries/my-nursery/gardeners/:gardener_id" },
    ],
  },
  {
    order: 9,
    id: "freelance_marketplace",
    title: "Freelance marketplace (optional, separate)",
    description: "Browse independent freelancers — different from nursery staff CRUD.",
    endpoints: [{ method: "GET", path: "/api/v1/gardeners/freelance", notes: "public browse" }],
  },
  {
    order: 10,
    id: "gardener_onboarding_doc",
    title: "Gardener onboarding catalog (staff vs freelance)",
    description: "Machine-readable map for mobile/docs — public + gardener me status.",
    endpoints: [
      { method: "GET", path: "/api/v1/gardeners/onboarding" },
      { method: "GET", path: "/api/v1/gardeners/onboarding/me", notes: "GARDENER JWT" },
    ],
  },
];

export type VendorOnboardingChecks = {
  nursery_registered: boolean;
  service_areas_configured: boolean;
  working_hours_configured: boolean;
  gallery_images: boolean;
  staff_team_configured: boolean;
  active_vendor_packages: boolean;
};

@Injectable()
export class VendorOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  async getDashboard(vendorUserId: string) {
    const nursery = await this.prisma.nursery.findUnique({
      where: { vendorId: vendorUserId },
      include: {
        serviceAreas: true,
        workingHours: true,
        images: true,
      },
    });

    let staffNonFreelance = 0;
    let activePackages = 0;
    if (nursery) {
      [staffNonFreelance, activePackages] = await Promise.all([
        this.prisma.gardener.count({
          where: { nurseryId: nursery.id, isFreelancer: false },
        }),
        this.prisma.vendorPackage.count({
          where: { nurseryId: nursery.id, isActive: true },
        }),
      ]);
    }

    const checks: VendorOnboardingChecks = {
      nursery_registered: !!nursery,
      service_areas_configured: (nursery?.serviceAreas.length ?? 0) > 0,
      working_hours_configured: (nursery?.workingHours.length ?? 0) > 0,
      gallery_images: (nursery?.images.length ?? 0) > 0,
      staff_team_configured: staffNonFreelance > 0,
      active_vendor_packages: activePackages > 0,
    };

    const minimum_ready_for_package_sales =
      checks.nursery_registered &&
      checks.service_areas_configured &&
      checks.active_vendor_packages;

    return {
      phase: "00_vendor_onboarding",
      minimum_ready_for_package_sales,
      recommended_next: this.recommendedNext(checks),
      checks,
      counts: {
        service_area_pincodes: nursery?.serviceAreas.length ?? 0,
        staff_non_freelance: staffNonFreelance,
        active_packages: activePackages,
        working_hour_rows: nursery?.workingHours.length ?? 0,
        gallery_images: nursery?.images.length ?? 0,
      },
      nursery_id: nursery?.id ?? null,
      canonical_flow: CANONICAL_FLOW,
      freelance_vs_staff_note:
        "Nursery staff: /api/v1/vendor/staff-gardeners (or legacy my-nursery/gardeners). Freelance self-serve + browse: GET /api/v1/gardeners/onboarding",
    };
  }

  private recommendedNext(c: VendorOnboardingChecks): string | null {
    if (!c.nursery_registered) return "Create nursery: POST /api/v1/nurseries";
    if (!c.service_areas_configured)
      return "Set service pincodes: PUT /api/v1/nurseries/my-nursery/service-areas";
    if (!c.working_hours_configured)
      return "Set hours: PUT /api/v1/nurseries/my-nursery/working-hours";
    if (!c.active_vendor_packages) return "Create a package: POST /api/v1/vendor/packages";
    if (!c.staff_team_configured)
      return "Optional: add staff — POST /api/v1/nurseries/my-nursery/gardeners";
    if (!c.gallery_images)
      return "Optional: gallery — POST /api/v1/nurseries/my-nursery/images";
    return null;
  }
}
