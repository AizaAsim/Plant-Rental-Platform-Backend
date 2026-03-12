// src/modules/app/gardeners/gardeners.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class GardenersService {
  constructor(private prisma: PrismaService) {}

  // ─── Create Profile ─────────────────────────────────────────────────────────

  async createProfile(userId: string, createDto: any) {
    const { bio, experience_years, hourly_rate, is_freelancer, skills, service_areas, availability } = createDto;

    const existing = await this.prisma.gardener.findUnique({ where: { userId } });
    if (existing) throw new ConflictException("Gardener profile already exists");

    if (is_freelancer && !hourly_rate) {
      throw new BadRequestException("Hourly rate is required for freelancers");
    }

    return this.prisma.gardener.create({
      data: {
        userId,
        bio,
        experienceYears: experience_years || 0,
        hourlyRate: hourly_rate ? new Decimal(hourly_rate) : null,
        isFreelancer: is_freelancer || false,
        isAvailable: true,
        skills: {
          create: skills?.map((skillName: string) => ({
            skill: { connectOrCreate: { where: { name: skillName }, create: { name: skillName } } },
          })) || [],
        },
        serviceAreas: {
          create: service_areas?.map((area: any) => ({ pincode: area.pincode, city: area.city })) || [],
        },
        availability: {
          create: availability?.map((avail: any) => ({
            dayOfWeek: avail.day_of_week,
            startTime: avail.start_time,
            endTime: avail.end_time,
            isAvailable: avail.is_available !== false,
          })) || [],
        },
      },
      include: {
        skills: { include: { skill: true } },
        serviceAreas: true,
        availability: true,
        user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true } },
      },
    });
  }

  // ─── Get Own Profile ────────────────────────────────────────────────────────

  async getProfile(userId: string) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId },
      include: {
        skills: { include: { skill: true } },
        serviceAreas: true,
        availability: true,
        nursery: { select: { id: true, name: true, city: true } },
        user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true } },
        _count: { select: { serviceBookings: true, maintenanceTasks: true } },
      },
    });
    if (!gardener) throw new NotFoundException("Gardener profile not found");

    return {
      ...gardener,
      stats: {
        total_bookings: gardener._count.serviceBookings,
        total_tasks: gardener._count.maintenanceTasks,
      },
    };
  }

  // ─── Update Profile ─────────────────────────────────────────────────────────

  async updateProfile(userId: string, updateDto: any) {
    const gardener = await this.prisma.gardener.findUnique({ where: { userId } });
    if (!gardener) throw new NotFoundException("Gardener profile not found");

    const { bio, experience_years, hourly_rate, is_freelancer } = updateDto;
    const updateData: Prisma.GardenerUpdateInput = {};

    if (bio !== undefined) updateData.bio = bio;
    if (experience_years !== undefined) updateData.experienceYears = Number(experience_years);
    if (hourly_rate !== undefined) updateData.hourlyRate = hourly_rate ? new Decimal(Number(hourly_rate)) : null;
    if (is_freelancer !== undefined) {
      updateData.isFreelancer = is_freelancer;
      if (is_freelancer && !hourly_rate && !gardener.hourlyRate) {
        throw new BadRequestException("Hourly rate is required for freelancers");
      }
    }

    return this.prisma.gardener.update({
      where: { userId },
      data: updateData,
      include: { skills: { include: { skill: true } }, serviceAreas: true, availability: true },
    });
  }

  // ─── Update Availability ────────────────────────────────────────────────────

  async updateAvailability(userId: string, availabilityDto: any) {
    const gardener = await this.prisma.gardener.findUnique({ where: { userId } });
    if (!gardener) throw new NotFoundException("Gardener profile not found");

    const { availability } = availabilityDto;
    await this.prisma.gardenerAvailability.deleteMany({ where: { gardenerId: gardener.id } });

    if (availability?.length) {
      await this.prisma.gardenerAvailability.createMany({
        data: availability.map((avail: any) => ({
          gardenerId: gardener.id,
          dayOfWeek: avail.day_of_week,
          startTime: avail.start_time,
          endTime: avail.end_time,
          isAvailable: avail.is_available !== false,
        })),
      });
    }

    return this.prisma.gardener.findUnique({ where: { id: gardener.id }, include: { availability: true } });
  }

  // ─── Update Service Areas ───────────────────────────────────────────────────

  async updateServiceAreas(userId: string, serviceAreasDto: any) {
    const gardener = await this.prisma.gardener.findUnique({ where: { userId } });
    if (!gardener) throw new NotFoundException("Gardener profile not found");

    const { service_areas } = serviceAreasDto;
    await this.prisma.gardenerServiceArea.deleteMany({ where: { gardenerId: gardener.id } });

    if (service_areas?.length) {
      await this.prisma.gardenerServiceArea.createMany({
        data: service_areas.map((area: any) => ({ gardenerId: gardener.id, pincode: area.pincode, city: area.city })),
      });
    }

    return this.prisma.gardener.findUnique({ where: { id: gardener.id }, include: { serviceAreas: true } });
  }

  // ─── Skills ─────────────────────────────────────────────────────────────────

  async addSkills(userId: string, skillsDto: any) {
    const { skill_ids } = skillsDto;
    const gardener = await this.prisma.gardener.findUnique({ where: { userId } });
    if (!gardener) throw new NotFoundException("Gardener profile not found");

    for (const skillIdOrName of skill_ids) {
      let skill = await this.prisma.gardenerSkill.findFirst({
        where: { OR: [{ id: skillIdOrName }, { name: skillIdOrName }] },
      });
      if (!skill) {
        skill = await this.prisma.gardenerSkill.create({ data: { name: skillIdOrName } });
      }
      await this.prisma.gardenerSkillMapping.upsert({
        where: { gardenerId_skillId: { gardenerId: gardener.id, skillId: skill.id } },
        create: { gardenerId: gardener.id, skillId: skill.id },
        update: {},
      });
    }

    return this.prisma.gardener.findUnique({
      where: { id: gardener.id },
      include: { skills: { include: { skill: true } } },
    });
  }

  async removeSkill(userId: string, skillId: string) {
    const gardener = await this.prisma.gardener.findUnique({ where: { userId } });
    if (!gardener) throw new NotFoundException("Gardener profile not found");

    await this.prisma.gardenerSkillMapping.deleteMany({ where: { gardenerId: gardener.id, skillId } });

    return this.prisma.gardener.findUnique({
      where: { id: gardener.id },
      include: { skills: { include: { skill: true } } },
    });
  }

  async getAllSkills() {
    return this.prisma.gardenerSkill.findMany({
      orderBy: { name: "asc" },
      include: { _count: { select: { gardeners: true } } },
    });
  }

  // ─── Browse Freelance ───────────────────────────────────────────────────────

  async browseFreelance(filterDto: any) {
    const {
      page = 1, limit = 20, pincode, city, skill_ids,
      rating_min, hourly_rate_min, hourly_rate_max,
      available_date, available_time, sort_by = "rating",
    } = filterDto;

    const parsedPage = Number(page);
    const parsedLimit = Number(limit);
    const parsedRatingMin = rating_min ? Number(rating_min) : undefined;
    const parsedRateMin = hourly_rate_min ? Number(hourly_rate_min) : undefined;
    const parsedRateMax = hourly_rate_max ? Number(hourly_rate_max) : undefined;
    const skillIdsArray = skill_ids
      ? Array.isArray(skill_ids) ? skill_ids : [skill_ids]
      : undefined;

    const where: Prisma.GardenerWhereInput = {
      isFreelancer: true,
      isAvailable: true,
      ...(pincode && { serviceAreas: { some: { pincode } } }),
      ...(city && { serviceAreas: { some: { city: { contains: city, mode: "insensitive" } } } }),
      ...(skillIdsArray?.length && { skills: { some: { skillId: { in: skillIdsArray } } } }),
      ...(parsedRatingMin !== undefined && { ratingAvg: { gte: new Decimal(parsedRatingMin) } }),
      ...(parsedRateMin !== undefined && { hourlyRate: { gte: new Decimal(parsedRateMin) } }),
      ...(parsedRateMax !== undefined && { hourlyRate: { lte: new Decimal(parsedRateMax) } }),
    };

    let orderBy: Prisma.GardenerOrderByWithRelationInput = {};
    switch (sort_by) {
      case "price":      orderBy = { hourlyRate: "asc" }; break;
      case "experience": orderBy = { experienceYears: "desc" }; break;
      default:           orderBy = { ratingAvg: "desc" };
    }

    const skip = (parsedPage - 1) * parsedLimit;
    const [gardeners, total] = await Promise.all([
      this.prisma.gardener.findMany({
        where, skip, take: parsedLimit, orderBy,
        include: {
          skills: { include: { skill: true } },
          serviceAreas: true,
          availability: true,
          user: { select: { id: true, fullName: true, avatarUrl: true } },
        },
      }),
      this.prisma.gardener.count({ where }),
    ]);

    let filteredGardeners = gardeners;
    if (available_date) {
      const dayOfWeek = new Date(available_date).getDay();
      filteredGardeners = gardeners.filter((g) => {
        const dayAvail = g.availability.find((a) => a.dayOfWeek === dayOfWeek && a.isAvailable);
        if (!dayAvail) return false;
        if (available_time) {
          const start = dayAvail.startTime || "00:00";
          const end = dayAvail.endTime || "23:59";
          return available_time >= start && available_time <= end;
        }
        return true;
      });
    }

    return {
      items: filteredGardeners,
      pagination: { page: parsedPage, limit: parsedLimit, total, totalPages: Math.ceil(total / parsedLimit) },
    };
  }

  // ─── Public Gardener Profile ────────────────────────────────────────────────

  async getGardenerById(gardenerId: string) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { id: gardenerId },
      include: {
        skills: { include: { skill: true } },
        serviceAreas: true,
        availability: true,
        nursery: { select: { id: true, name: true, city: true } },
        user: { select: { id: true, fullName: true, email: true, phone: true, avatarUrl: true } },
        _count: { select: { serviceBookings: true, maintenanceTasks: true } },
      },
    });
    if (!gardener) throw new NotFoundException("Gardener not found");
    return gardener;
  }

  // ─── Reviews ────────────────────────────────────────────────────────────────

  async getGardenerReviews(gardenerId: string, filterDto: any) {
    const { page = 1, limit = 20, rating } = filterDto;
    const parsedPage = Number(page);
    const parsedLimit = Number(limit);

    const gardener = await this.prisma.gardener.findUnique({ where: { id: gardenerId } });
    if (!gardener) throw new NotFoundException("Gardener not found");

    const where: Prisma.ReviewWhereInput = {
      reviewableType: "GARDENER",
      reviewableId: gardenerId,
      isActive: true,
      ...(rating && { rating: Number(rating) }),
    };

    const skip = (parsedPage - 1) * parsedLimit;
    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where, skip, take: parsedLimit, orderBy: { createdAt: "desc" },
        include: { user: { select: { id: true, fullName: true, avatarUrl: true } }, images: true },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: reviews,
      pagination: { page: parsedPage, limit: parsedLimit, total, totalPages: Math.ceil(total / parsedLimit) },
    };
  }

  // ─── Availability ───────────────────────────────────────────────────────────

  async checkAvailability(gardenerId: string, filterDto: any) {
    const { date, duration_hours } = filterDto;

    const gardener = await this.prisma.gardener.findUnique({
      where: { id: gardenerId },
      include: {
        availability: true,
        serviceBookings: { where: { status: { in: ["CONFIRMED", "IN_PROGRESS"] } } },
      },
    });
    if (!gardener) throw new NotFoundException("Gardener not found");

    if (!gardener.isAvailable || !gardener.isFreelancer) {
      return { available: false, reason: "Gardener is not available for freelance work" };
    }

    if (!date) {
      return { availability: gardener.availability, is_available: gardener.isAvailable };
    }

    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();
    const dayAvailability = gardener.availability.find(
      (a) => a.dayOfWeek === dayOfWeek && a.isAvailable
    );
    if (!dayAvailability) return { available: false, reason: "Not available on this day" };

    const conflictingBookings = gardener.serviceBookings.filter((b) => {
      return new Date(b.serviceDate).toDateString() === requestedDate.toDateString();
    });

    const startTime = dayAvailability.startTime || "09:00";
    const endTime = dayAvailability.endTime || "18:00";
    const slots = this.generateTimeSlots(startTime, endTime, Number(duration_hours) || 2);

    const availableSlots = slots.filter((slot) => {
      return !conflictingBookings.some((b) => {
        const bStart = b.serviceTime;
        const bEnd = this.addHours(bStart, Number(b.durationHours));
        return (
          (slot.start >= bStart && slot.start < bEnd) ||
          (slot.end > bStart && slot.end <= bEnd)
        );
      });
    });

    return { available: availableSlots.length > 0, available_slots: availableSlots, day_availability: dayAvailability };
  }

  // ─── Invitation System ──────────────────────────────────────────────────────

  async getGardenerInvitations(userId: string) {
    const gardener = await this.prisma.gardener.findUnique({ where: { userId } });
    if (!gardener) throw new NotFoundException("Gardener profile not found");

    return this.prisma.nurseryInvitation.findMany({
      where: { gardenerId: gardener.id },
      orderBy: { createdAt: "desc" },
      include: {
        nursery: {
          select: { id: true, name: true, city: true, logoUrl: true, phone: true },
        },
      },
    });
  }

  async acceptNurseryInvitation(userId: string, invitationId: string) {
    const gardener = await this.prisma.gardener.findUnique({ where: { userId } });
    if (!gardener) throw new NotFoundException("Gardener profile not found");

    const invitation = await this.prisma.nurseryInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new NotFoundException("Invitation not found");
    if (invitation.gardenerId !== gardener.id) throw new ForbiddenException();
    if (invitation.status !== "PENDING") {
      throw new BadRequestException(`Invitation is already ${invitation.status.toLowerCase()}`);
    }
    if (invitation.expiresAt < new Date()) {
      throw new BadRequestException("Invitation has expired");
    }

    await this.prisma.$transaction([
      this.prisma.gardener.update({
        where: { id: gardener.id },
        data: { nurseryId: invitation.nurseryId },
      }),
      this.prisma.nurseryInvitation.update({
        where: { id: invitationId },
        data: { status: "ACCEPTED" },
      }),
    ]);

    return { message: "Invitation accepted — you are now assigned to the nursery" };
  }

  async declineNurseryInvitation(userId: string, invitationId: string) {
    const gardener = await this.prisma.gardener.findUnique({ where: { userId } });
    if (!gardener) throw new NotFoundException("Gardener profile not found");

    const invitation = await this.prisma.nurseryInvitation.findUnique({
      where: { id: invitationId },
    });
    if (!invitation) throw new NotFoundException("Invitation not found");
    if (invitation.gardenerId !== gardener.id) throw new ForbiddenException();
    if (invitation.status !== "PENDING") {
      throw new BadRequestException(`Invitation is already ${invitation.status.toLowerCase()}`);
    }

    await this.prisma.nurseryInvitation.update({
      where: { id: invitationId },
      data: { status: "DECLINED" },
    });

    return { message: "Invitation declined" };
  }

  // ─── Leave Nursery ──────────────────────────────────────────────────────────

  async leaveNursery(userId: string) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId },
      include: {
        maintenanceTasks: {
          where: { status: { in: ["PENDING", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"] } },
        },
      },
    });
    if (!gardener) throw new NotFoundException("Gardener profile not found");
    if (!gardener.nurseryId) throw new BadRequestException("Gardener is not assigned to any nursery");
    if (gardener.maintenanceTasks.length > 0) {
      throw new BadRequestException("Cannot leave nursery with pending tasks");
    }

    return this.prisma.gardener.update({ where: { id: gardener.id }, data: { nurseryId: null } });
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private generateTimeSlots(startTime: string, endTime: string, durationHours: number): any[] {
    const slots = [];
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);
    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const slotStart = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;
      const endObj = this.addHours(slotStart, durationHours);
      const slotEnd = `${String(endObj.hour).padStart(2, "0")}:${String(endObj.minute).padStart(2, "0")}`;

      if (endObj.hour < endHour || (endObj.hour === endHour && endObj.minute <= endMin)) {
        slots.push({ start: slotStart, end: slotEnd });
      }
      currentMin += 30;
      if (currentMin >= 60) { currentHour++; currentMin = 0; }
    }
    return slots;
  }

  private addHours(timeString: string, hours: number): { hour: number; minute: number } {
    const [hour, minute] = timeString.split(":").map(Number);
    let newHour = hour + Math.floor(hours);
    let newMinute = minute + (hours % 1) * 60;
    if (newMinute >= 60) { newHour++; newMinute -= 60; }
    return { hour: newHour, minute: newMinute };
  }
}