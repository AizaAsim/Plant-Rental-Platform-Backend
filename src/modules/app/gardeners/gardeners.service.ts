// src/modules/app/gardeners/gardeners.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { Prisma } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";
import { Decimal } from "@prisma/client/runtime/library";

@Injectable()
export class GardenersService {
  constructor(private prisma: PrismaService) {}

  // POST /api/v1/gardeners/profile
  async createProfile(gardenerId: string, createDto: any) {
    const {
      bio,
      experience_years,
      hourly_rate,
      is_freelancer,
      skills,
      service_areas,
      availability,
    } = createDto;

    // Check if profile already exists
    const existing = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (existing) {
      throw new ConflictException("Gardener profile already exists");
    }

    // Validate freelancer requirements
    if (is_freelancer && !hourly_rate) {
      throw new BadRequestException("Hourly rate is required for freelancers");
    }

    // Create gardener profile
    const gardener = await this.prisma.gardener.create({
      data: {
        userId: gardenerId,
        bio,
        experienceYears: experience_years || 0,
        hourlyRate: hourly_rate ? new Decimal(hourly_rate) : null,
        isFreelancer: is_freelancer || false,
        isAvailable: true,
        skills: {
          create: skills?.map((skillName: string) => ({
            skill: {
              connectOrCreate: {
                where: { name: skillName },
                create: { name: skillName },
              },
            },
          })) || [],
        },
        serviceAreas: {
          create: service_areas?.map((area: any) => ({
            pincode: area.pincode,
            city: area.city,
          })) || [],
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
        skills: {
          include: {
            skill: true,
          },
        },
        serviceAreas: true,
        availability: true,
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
      },
    });

    return gardener;
  }

  // GET /api/v1/gardeners/profile
  async getProfile(gardenerId: string) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
        serviceAreas: true,
        availability: true,
        nursery: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            serviceBookings: true,
            maintenanceTasks: true,
          },
        },
      },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    return {
      ...gardener,
      stats: {
        total_bookings: gardener._count.serviceBookings,
        total_tasks: gardener._count.maintenanceTasks,
      },
    };
  }

  // PUT /api/v1/gardeners/profile
  async updateProfile(gardenerId: string, updateDto: any) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const {
      bio,
      experience_years,
      hourly_rate,
      is_freelancer,
    } = updateDto;

    const updateData: Prisma.GardenerUpdateInput = {};

    if (bio !== undefined) updateData.bio = bio;
    if (experience_years !== undefined) updateData.experienceYears = experience_years;
    if (hourly_rate !== undefined) {
      if (is_freelancer !== false && !hourly_rate) {
        throw new BadRequestException("Hourly rate is required for freelancers");
      }
      updateData.hourlyRate = hourly_rate ? new Decimal(hourly_rate) : null;
    }
    if (is_freelancer !== undefined) {
      updateData.isFreelancer = is_freelancer;
      if (is_freelancer && !hourly_rate && !gardener.hourlyRate) {
        throw new BadRequestException("Hourly rate is required for freelancers");
      }
    }

    const updated = await this.prisma.gardener.update({
      where: { userId: gardenerId },
      data: updateData,
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
        serviceAreas: true,
        availability: true,
      },
    });

    return updated;
  }

  // PUT /api/v1/gardeners/availability
  async updateAvailability(gardenerId: string, availabilityDto: any) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const { availability } = availabilityDto;

    // Delete existing availability
    await this.prisma.gardenerAvailability.deleteMany({
      where: { gardenerId: gardener.id },
    });

    // Create new availability
    if (availability && availability.length > 0) {
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

    const updated = await this.prisma.gardener.findUnique({
      where: { id: gardener.id },
      include: {
        availability: true,
      },
    });

    return updated;
  }

  // PUT /api/v1/gardeners/service-areas
  async updateServiceAreas(gardenerId: string, serviceAreasDto: any) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    const { service_areas } = serviceAreasDto;

    // Delete existing service areas
    await this.prisma.gardenerServiceArea.deleteMany({
      where: { gardenerId: gardener.id },
    });

    // Create new service areas
    if (service_areas && service_areas.length > 0) {
      await this.prisma.gardenerServiceArea.createMany({
        data: service_areas.map((area: any) => ({
          gardenerId: gardener.id,
          pincode: area.pincode,
          city: area.city,
        })),
      });
    }

    const updated = await this.prisma.gardener.findUnique({
      where: { id: gardener.id },
      include: {
        serviceAreas: true,
      },
    });

    return updated;
  }

  // POST /api/v1/gardeners/skills
  async addSkills(gardenerId: string, skillsDto: any) {
    const { skill_ids } = skillsDto;

    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    // Get skill names from IDs or create if names provided
    const skillsToAdd = [];
    for (const skillIdOrName of skill_ids) {
      // Check if it's an ID or name
      const skill = await this.prisma.gardenerSkill.findFirst({
        where: {
          OR: [
            { id: skillIdOrName },
            { name: skillIdOrName },
          ],
        },
      });

      if (skill) {
        skillsToAdd.push(skill.id);
      } else {
        // Create new skill
        const newSkill = await this.prisma.gardenerSkill.create({
          data: { name: skillIdOrName },
        });
        skillsToAdd.push(newSkill.id);
      }
    }

    // Add skills (skip if already exists)
    for (const skillId of skillsToAdd) {
      await this.prisma.gardenerSkillMapping.upsert({
        where: {
          gardenerId_skillId: {
            gardenerId: gardener.id,
            skillId,
          },
        },
        create: {
          gardenerId: gardener.id,
          skillId,
        },
        update: {},
      });
    }

    const updated = await this.prisma.gardener.findUnique({
      where: { id: gardener.id },
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
      },
    });

    return updated;
  }

  // DELETE /api/v1/gardeners/skills/{skill_id}
  async removeSkill(gardenerId: string, skillId: string) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    await this.prisma.gardenerSkillMapping.deleteMany({
      where: {
        gardenerId: gardener.id,
        skillId,
      },
    });

    const updated = await this.prisma.gardener.findUnique({
      where: { id: gardener.id },
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
      },
    });

    return updated;
  }

  // GET /api/v1/gardeners/freelance
  async browseFreelance(filterDto: any) {
    const {
      page = 1,
      limit = 20,
      pincode,
      city,
      skill_ids,
      rating_min,
      hourly_rate_min,
      hourly_rate_max,
      available_date,
      available_time,
      sort_by = "rating",
    } = filterDto;

    const where: Prisma.GardenerWhereInput = {
      isFreelancer: true,
      isAvailable: true,
      ...(pincode && {
        serviceAreas: {
          some: {
            pincode,
          },
        },
      }),
      ...(city && {
        serviceAreas: {
          some: {
            city: { contains: city, mode: "insensitive" },
          },
        },
      }),
      ...(skill_ids && Array.isArray(skill_ids) && skill_ids.length > 0 && {
        skills: {
          some: {
            skillId: { in: skill_ids },
          },
        },
      }),
      ...(rating_min && { ratingAvg: { gte: new Decimal(rating_min) } }),
      ...(hourly_rate_min && { hourlyRate: { gte: new Decimal(hourly_rate_min) } }),
      ...(hourly_rate_max && { hourlyRate: { lte: new Decimal(hourly_rate_max) } }),
    };

    let orderBy: Prisma.GardenerOrderByWithRelationInput = {};
    switch (sort_by) {
      case "price":
        orderBy = { hourlyRate: "asc" };
        break;
      case "experience":
        orderBy = { experienceYears: "desc" };
        break;
      case "rating":
      default:
        orderBy = { ratingAvg: "desc" };
    }

    const skip = (page - 1) * limit;

    const [gardeners, total] = await Promise.all([
      this.prisma.gardener.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          skills: {
            include: {
              skill: true,
            },
          },
          serviceAreas: true,
          availability: true,
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
        },
      }),
      this.prisma.gardener.count({ where }),
    ]);

    // Filter by availability if date/time provided
    let filteredGardeners = gardeners;
    if (available_date) {
      const date = new Date(available_date);
      const dayOfWeek = date.getDay();

      filteredGardeners = gardeners.filter((gardener) => {
        const dayAvailability = gardener.availability.find(
          (avail) => avail.dayOfWeek === dayOfWeek && avail.isAvailable
        );

        if (!dayAvailability) return false;

        if (available_time) {
          const requestedTime = available_time;
          const startTime = dayAvailability.startTime || "00:00";
          const endTime = dayAvailability.endTime || "23:59";

          return requestedTime >= startTime && requestedTime <= endTime;
        }

        return true;
      });
    }

    return {
      items: filteredGardeners,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET /api/v1/gardeners/{gardener_id}
  async getGardenerById(gardenerId: string) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { id: gardenerId },
      include: {
        skills: {
          include: {
            skill: true,
          },
        },
        serviceAreas: true,
        availability: true,
        nursery: {
          select: {
            id: true,
            name: true,
            city: true,
          },
        },
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
            avatarUrl: true,
          },
        },
        _count: {
          select: {
            serviceBookings: true,
            maintenanceTasks: true,
          },
        },
      },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener not found");
    }

    return gardener;
  }

  // GET /api/v1/gardeners/{gardener_id}/reviews
  async getGardenerReviews(gardenerId: string, filterDto: any) {
    const { page = 1, limit = 20, rating } = filterDto;

    const gardener = await this.prisma.gardener.findUnique({
      where: { id: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener not found");
    }

    const where: Prisma.ReviewWhereInput = {
      reviewableType: "GARDENER",
      reviewableId: gardenerId,
      isActive: true,
      ...(rating && { rating: parseInt(rating) }),
    };

    const skip = (page - 1) * limit;

    const [reviews, total] = await Promise.all([
      this.prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        include: {
          user: {
            select: {
              id: true,
              fullName: true,
              avatarUrl: true,
            },
          },
          images: true,
        },
      }),
      this.prisma.review.count({ where }),
    ]);

    return {
      items: reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  // GET /api/v1/gardeners/{gardener_id}/availability
  async checkAvailability(gardenerId: string, filterDto: any) {
    const { date, duration_hours } = filterDto;

    const gardener = await this.prisma.gardener.findUnique({
      where: { id: gardenerId },
      include: {
        availability: true,
        serviceBookings: {
          where: {
            status: {
              in: ["CONFIRMED", "IN_PROGRESS"],
            },
          },
        },
      },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener not found");
    }

    if (!gardener.isAvailable || !gardener.isFreelancer) {
      return {
        available: false,
        reason: "Gardener is not available for freelance work",
      };
    }

    if (!date) {
      // Return general availability
      return {
        availability: gardener.availability,
        is_available: gardener.isAvailable,
      };
    }

    const requestedDate = new Date(date);
    const dayOfWeek = requestedDate.getDay();

    // Check day availability
    const dayAvailability = gardener.availability.find(
      (avail) => avail.dayOfWeek === dayOfWeek && avail.isAvailable
    );

    if (!dayAvailability) {
      return {
        available: false,
        reason: "Not available on this day",
      };
    }

    // Check existing bookings
    const conflictingBookings = gardener.serviceBookings.filter((booking) => {
      const bookingDate = new Date(booking.serviceDate);
      return (
        bookingDate.toDateString() === requestedDate.toDateString() &&
        ["CONFIRMED", "IN_PROGRESS"].includes(booking.status)
      );
    });

    // Generate available time slots
    const startTime = dayAvailability.startTime || "09:00";
    const endTime = dayAvailability.endTime || "18:00";
    const slots = this.generateTimeSlots(startTime, endTime, duration_hours || 2);

    // Filter out conflicting slots
    const availableSlots = slots.filter((slot) => {
      return !conflictingBookings.some((booking) => {
        const bookingStart = booking.serviceTime;
        const bookingEnd = this.addHours(bookingStart, Number(booking.durationHours));
        return (
          (slot.start >= bookingStart && slot.start < bookingEnd) ||
          (slot.end > bookingStart && slot.end <= bookingEnd)
        );
      });
    });

    return {
      available: availableSlots.length > 0,
      available_slots: availableSlots,
      day_availability: dayAvailability,
    };
  }

  // POST /api/v1/gardeners/nursery-invitation/{invitation_id}/accept
  async acceptNurseryInvitation(gardenerId: string, invitationId: string) {
    // Note: This assumes there's a nursery invitation system
    // For now, we'll implement a simplified version
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    // In a real system, you'd fetch the invitation and get nurseryId from it
    // For now, this is a placeholder
    throw new BadRequestException("Nursery invitation system not yet implemented");
  }

  // POST /api/v1/gardeners/nursery-invitation/{invitation_id}/decline
  async declineNurseryInvitation(gardenerId: string, invitationId: string) {
    // Placeholder
    return { message: "Invitation declined" };
  }

  // POST /api/v1/gardeners/leave-nursery
  async leaveNursery(gardenerId: string) {
    const gardener = await this.prisma.gardener.findUnique({
      where: { userId: gardenerId },
      include: {
        maintenanceTasks: {
          where: {
            status: {
              in: ["PENDING", "ASSIGNED", "ACCEPTED", "IN_PROGRESS"],
            },
          },
        },
      },
    });

    if (!gardener) {
      throw new NotFoundException("Gardener profile not found");
    }

    if (!gardener.nurseryId) {
      throw new BadRequestException("Gardener is not assigned to any nursery");
    }

    if (gardener.maintenanceTasks.length > 0) {
      throw new BadRequestException("Cannot leave nursery with pending tasks");
    }

    const updated = await this.prisma.gardener.update({
      where: { id: gardener.id },
      data: { nurseryId: null },
    });

    return updated;
  }

  // GET /api/v1/gardeners/skills/all
  async getAllSkills() {
    const skills = await this.prisma.gardenerSkill.findMany({
      orderBy: { name: "asc" },
      include: {
        _count: {
          select: {
            gardeners: true,
          },
        },
      },
    });

    return skills;
  }

  // Helper: Generate time slots
  private generateTimeSlots(startTime: string, endTime: string, durationHours: number): any[] {
    const slots = [];
    const [startHour, startMin] = startTime.split(":").map(Number);
    const [endHour, endMin] = endTime.split(":").map(Number);

    let currentHour = startHour;
    let currentMin = startMin;

    while (currentHour < endHour || (currentHour === endHour && currentMin < endMin)) {
      const slotStart = `${String(currentHour).padStart(2, "0")}:${String(currentMin).padStart(2, "0")}`;
      const endTimeObj = this.addHours(slotStart, durationHours);
      const slotEnd = `${String(endTimeObj.hour).padStart(2, "0")}:${String(endTimeObj.minute).padStart(2, "0")}`;

      if (endTimeObj.hour < endHour || (endTimeObj.hour === endHour && endTimeObj.minute <= endMin)) {
        slots.push({
          start: slotStart,
          end: slotEnd,
        });
      }

      // Move to next slot (30-minute intervals)
      currentMin += 30;
      if (currentMin >= 60) {
        currentHour++;
        currentMin = 0;
      }
    }

    return slots;
  }

  // Helper: Add hours to time string
  private addHours(timeString: string, hours: number): { hour: number; minute: number } {
    const [hour, minute] = timeString.split(":").map(Number);
    let newHour = hour + Math.floor(hours);
    let newMinute = minute + (hours % 1) * 60;

    if (newMinute >= 60) {
      newHour++;
      newMinute -= 60;
    }

    return { hour: newHour, minute: newMinute };
  }
}
