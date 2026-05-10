import { ForbiddenException, Injectable } from "@nestjs/common";
import { UserRole } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

export type OnboardingEndpoint = { method: string; path: string; auth: string; notes?: string };

export type GardenerOnboardingFlow = {
  id: string;
  title: string;
  description: string;
  endpoints: OnboardingEndpoint[];
};

const STAFF_VENDOR_FLOW: GardenerOnboardingFlow = {
  id: "staff_vendor_managed",
  title: "Staff gardeners (vendor-created)",
  description:
    "Vendor creates User+Gardener rows, issues temporary password, updates profile, resets credentials, activates/deactivates. Same behaviour under legacy nursery paths and under /vendor/staff-gardeners.",
  endpoints: [
    { method: "POST", path: "/api/v1/vendor/staff-gardeners", auth: "VENDOR", notes: "create staff; returns temporary_password" },
    { method: "GET", path: "/api/v1/vendor/staff-gardeners", auth: "VENDOR", notes: "list nursery gardeners" },
    { method: "GET", path: "/api/v1/vendor/staff-gardeners/:gardener_id", auth: "VENDOR" },
    { method: "PUT", path: "/api/v1/vendor/staff-gardeners/:gardener_id", auth: "VENDOR" },
    { method: "POST", path: "/api/v1/vendor/staff-gardeners/:gardener_id/reset-credentials", auth: "VENDOR" },
    { method: "POST", path: "/api/v1/vendor/staff-gardeners/:gardener_id/status", auth: "VENDOR", notes: "body: is_active, optional reason" },
    { method: "POST", path: "/api/v1/vendor/staff-gardeners/:gardener_id/invite", auth: "VENDOR", notes: "invite existing gardener user to nursery" },
    { method: "GET", path: "/api/v1/vendor/staff-gardeners/invitations/sent", auth: "VENDOR" },
    { method: "DELETE", path: "/api/v1/vendor/staff-gardeners/:gardener_id", auth: "VENDOR", notes: "detach from nursery" },
    { method: "POST", path: "/api/v1/nurseries/my-nursery/gardeners", auth: "VENDOR", notes: "legacy; same as POST /vendor/staff-gardeners" },
    { method: "GET", path: "/api/v1/nurseries/my-nursery/gardeners", auth: "VENDOR" },
    { method: "GET", path: "/api/v1/nurseries/my-nursery/gardeners/:gardener_id", auth: "VENDOR" },
    { method: "PUT", path: "/api/v1/nurseries/my-nursery/gardeners/:gardener_id", auth: "VENDOR" },
    { method: "POST", path: "/api/v1/nurseries/my-nursery/gardeners/:gardener_id/reset-credentials", auth: "VENDOR" },
    { method: "POST", path: "/api/v1/nurseries/my-nursery/gardeners/:gardener_id/status", auth: "VENDOR" },
    { method: "POST", path: "/api/v1/nurseries/my-nursery/gardeners/:gardener_id/invite", auth: "VENDOR" },
    { method: "GET", path: "/api/v1/nurseries/my-nursery/invitations", auth: "VENDOR" },
    { method: "DELETE", path: "/api/v1/nurseries/my-nursery/gardeners/:gardener_id", auth: "VENDOR" },
  ],
};

const FREELANCE_SELF_FLOW: GardenerOnboardingFlow = {
  id: "freelance_self_service",
  title: "Freelance gardeners (self-serve profile)",
  description:
    "User registers as GARDENER (or is promoted), then creates their own profile with rates, skills, areas, and availability.",
  endpoints: [
    { method: "POST", path: "/api/v1/auth/register", auth: "public", notes: "role GARDENER; optional gardener_type hint" },
    { method: "POST", path: "/api/v1/auth/login", auth: "public" },
    { method: "POST", path: "/api/v1/gardeners/profile", auth: "GARDENER", notes: "is_freelancer: true + hourly_rate" },
    { method: "GET", path: "/api/v1/gardeners/profile", auth: "GARDENER" },
    { method: "PUT", path: "/api/v1/gardeners/profile", auth: "GARDENER" },
    { method: "PUT", path: "/api/v1/gardeners/availability", auth: "GARDENER" },
    { method: "PUT", path: "/api/v1/gardeners/service-areas", auth: "GARDENER" },
    { method: "POST", path: "/api/v1/gardeners/skills", auth: "GARDENER" },
    { method: "GET", path: "/api/v1/gardeners/invitations", auth: "GARDENER", notes: "nursery invites to join as staff" },
    { method: "POST", path: "/api/v1/gardeners/nursery-invitation/:invitation_id/accept", auth: "GARDENER" },
    { method: "POST", path: "/api/v1/gardeners/nursery-invitation/:invitation_id/decline", auth: "GARDENER" },
    { method: "POST", path: "/api/v1/gardeners/leave-nursery", auth: "GARDENER" },
  ],
};

const PUBLIC_DISCOVERY: GardenerOnboardingFlow = {
  id: "public_marketplace",
  title: "Discovery (customers / vendors)",
  description: "Browse freelancers and public gardener profiles.",
  endpoints: [
    { method: "GET", path: "/api/v1/gardeners/freelance", auth: "public" },
    { method: "GET", path: "/api/v1/gardeners/skills/all", auth: "public" },
    { method: "GET", path: "/api/v1/gardeners/:gardener_id", auth: "public" },
  ],
};

const FREELANCE_MAINTENANCE_JOBS: GardenerOnboardingFlow = {
  id: "freelance_jobs_api",
  title: "Freelance maintenance jobs (separate from nursery tasks)",
  description:
    "Customer posts OPEN jobs; freelancers accept, start, complete; customer reviews. `job_id` in paths = public `FJB-…` or row UUID. Nurseries use `maintenanceTasks` + staff; this flow is `FreelanceJob` records.",
  endpoints: [
    { method: "POST", path: "/api/v1/freelance-jobs", auth: "USER", notes: "creates OPEN" },
    { method: "GET", path: "/api/v1/freelance-jobs/my-requests", auth: "USER" },
    { method: "GET", path: "/api/v1/freelance-jobs/:job_id", auth: "USER | GARDENER", notes: "owner or assigned gardener" },
    { method: "POST", path: "/api/v1/freelance-jobs/:job_id/review", auth: "USER", notes: "COMPLETED only" },
    { method: "GET", path: "/api/v1/freelance-jobs/open", auth: "GARDENER", notes: "freelance profile required" },
    { method: "GET", path: "/api/v1/freelance-jobs/my-jobs", auth: "GARDENER" },
    { method: "POST", path: "/api/v1/freelance-jobs/:job_id/accept", auth: "GARDENER" },
    {
      method: "POST",
      path: "/api/v1/freelance-jobs/:job_id/withdraw",
      auth: "GARDENER",
      notes: "ACCEPTED → OPEN before payment or start",
    },
    { method: "POST", path: "/api/v1/freelance-jobs/:job_id/start", auth: "GARDENER", notes: "requires paid_at when budget set" },
    { method: "POST", path: "/api/v1/freelance-jobs/:job_id/complete", auth: "GARDENER" },
    {
      method: "POST",
      path: "/api/v1/freelance-jobs/:job_id/cancel",
      auth: "USER",
      notes: "OPEN/ACCEPTED only; blocked if pending/paid freelance payment",
    },
    {
      method: "POST",
      path: "/api/v1/payments/initiate",
      auth: "USER",
      notes: 'payment_for: FREELANCE_JOB, reference_id: job UUID or FJB-* (ACCEPTED + budget_amount)',
    },
  ],
};

@Injectable()
export class GardenerOnboardingService {
  constructor(private readonly prisma: PrismaService) {}

  getCatalog() {
    return {
      phase: "gardener_onboarding",
      summary:
        "Staff paths are vendor-authenticated (create/update/credentials). Freelance paths are gardener-authenticated self-service. These are separate lifecycles.",
      staff_vendor_managed: STAFF_VENDOR_FLOW,
      freelance_self_service: FREELANCE_SELF_FLOW,
      public_discovery: PUBLIC_DISCOVERY,
      freelance_maintenance_jobs: FREELANCE_MAINTENANCE_JOBS,
      legacy_equivalent_base: "/api/v1/nurseries/my-nursery/gardeners",
    };
  }

  async getSelfStatus(userId: string, role: UserRole) {
    if (role !== UserRole.GARDENER) {
      throw new ForbiddenException("Gardener role required");
    }
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId },
      include: {
        nursery: { select: { id: true, name: true, slug: true } },
        user: { select: { mustChangePassword: true, isActive: true } },
      },
    });
    if (!gardener) {
      return {
        gardener_profile_exists: false,
        path: "none",
        is_freelancer: null,
        nursery_attached: false,
        must_change_password: null,
        recommended_next:
          "Create profile: POST /api/v1/gardeners/profile (set is_freelancer true for freelance, false if you only work under a vendor account created for you)",
      };
    }
    const staffLike = Boolean(gardener.nurseryId && !gardener.isFreelancer);
    const freelanceLike = Boolean(gardener.isFreelancer);
    let path: "staff" | "freelance" | "hybrid" = "hybrid";
    if (staffLike && !freelanceLike) path = "staff";
    else if (freelanceLike && !gardener.nurseryId) path = "freelance";
    else if (freelanceLike && gardener.nurseryId) path = "hybrid";

    return {
      gardener_profile_exists: true,
      gardener_id: gardener.id,
      path,
      is_freelancer: gardener.isFreelancer,
      nursery_attached: Boolean(gardener.nurseryId),
      nursery: gardener.nursery,
      must_change_password: gardener.user.mustChangePassword,
      account_active: gardener.user.isActive && gardener.isAvailable,
      recommended_next: this.selfRecommended(gardener.user.mustChangePassword, path),
    };
  }

  private selfRecommended(mustChange: boolean, path: string): string | null {
    if (mustChange) return "Change password via auth flows; then GET /api/v1/gardeners/profile";
    if (path === "freelance") return "Ensure hourly rate and service areas — PUT /api/v1/gardeners/profile, service-areas";
    if (path === "staff") return "Staff account ready; optional: accept nursery workflow via invitations routes if used";
    return null;
  }
}
