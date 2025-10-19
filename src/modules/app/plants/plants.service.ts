// src/modules/app/plants/plants.service.ts
import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { PlantFilterDto } from "./dto/plant-filter.dto";
import { PlantSearchDto } from "./dto/plant-search.dto";
import { Prisma, PlantCategory } from "@prisma/client";
import { PrismaService } from "src/prisma/prisma.service";

@Injectable()
export class PlantsService {
  constructor(private prisma: PrismaService) {}

  async findAll(filterDto: PlantFilterDto) {
    const {
      page = 1,
      limit = 20,
      category,
      size,
      careLevel,
      lightRequirement,
      isPetSafe,
      isIndoor,
      available,
      minPrice,
      maxPrice,
      minRentalPrice,
      maxRentalPrice,
      nurseryId,
      featured,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = filterDto;

    const where: Prisma.PlantWhereInput = {
      isActive: true,
      ...(category && { category }),
      ...(size && { size }),
      ...(careLevel && { careLevel }),
      ...(lightRequirement && { lightRequirement }),
      ...(isPetSafe !== undefined && { isPetSafe }),
      ...(isIndoor !== undefined && { isIndoor }),
      ...(available && { availableStock: { gt: 0 } }),
      ...(nurseryId && { nurseryId }),
      ...(featured && { isFeatured: true }),
      ...(minPrice || maxPrice
        ? {
            purchasePrice: {
              ...(minPrice && { gte: minPrice }),
              ...(maxPrice && { lte: maxPrice }),
            },
          }
        : {}),
      ...(minRentalPrice || maxRentalPrice
        ? {
            rentalPrice: {
              ...(minRentalPrice && { gte: minRentalPrice }),
              ...(maxRentalPrice && { lte: maxRentalPrice }),
            },
          }
        : {}),
    };

    // Build orderBy
    let orderBy: Prisma.PlantOrderByWithRelationInput = {};
    switch (sortBy) {
      case "price":
        orderBy = { purchasePrice: sortOrder };
        break;
      case "rentalPrice":
        orderBy = { rentalPrice: sortOrder };
        break;
      case "name":
        orderBy = { name: sortOrder };
        break;
      case "popularity":
        // Order by review count or rental count
        orderBy = { rentals: { _count: sortOrder } };
        break;
      default:
        orderBy = { createdAt: sortOrder };
    }

    const skip = (page - 1) * limit;

    const [plants, total] = await this.prisma.$transaction([
      this.prisma.plant.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          nursery: {
            select: {
              id: true,
              name: true,
              city: true,
              rating: true,
              logo: true,
            },
          },
          reviews: {
            select: {
              rating: true,
            },
          },
          _count: {
            select: {
              reviews: true,
              rentals: true,
            },
          },
        },
      }),
      this.prisma.plant.count({ where }),
    ]);

    // Calculate average ratings
    const plantsWithRatings = plants.map((plant) => {
      const { reviews, _count, ...plantData } = plant;
      const averageRating =
        reviews.length > 0
          ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length
          : 0;

      return {
        ...plantData,
        averageRating: Math.round(averageRating * 10) / 10,
        totalReviews: _count.reviews,
        popularity: _count.rentals,
      };
    });

    const totalPages = Math.ceil(total / limit);

    return {
      data: plantsWithRatings,
      total,
      page,
      limit,
      totalPages,
      hasNext: page < totalPages,
      hasPrevious: page > 1,
    };
  }

  async findById(id: string) {
    const plant = await this.prisma.plant.findFirst({
      where: {
        id,
        isActive: true,
      },
      include: {
        nursery: {
          select: {
            id: true,
            name: true,
            email: true,
            phone: true,
            description: true,
            logo: true,
            rating: true,
            address: true,
            city: true,
            state: true,
            deliveryFee: true,
            minimumOrder: true,
          },
        },
        reviews: {
          where: {
            type: "PLANT",
          },
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                avatar: true,
              },
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
        _count: {
          select: {
            reviews: true,
            rentals: true,
            purchases: true,
          },
        },
      },
    });

    if (!plant) {
      throw new NotFoundException("Plant not found");
    }

    // Calculate average rating
    const averageRating =
      plant.reviews.length > 0
        ? plant.reviews.reduce((sum, r) => sum + r.rating, 0) /
          plant.reviews.length
        : 0;

    // Get related plants
    const relatedPlants = await this.prisma.plant.findMany({
      where: {
        OR: [{ category: plant.category }, { careLevel: plant.careLevel }],
        id: { not: plant.id },
        isActive: true,
        availableStock: { gt: 0 },
      },
      take: 6,
      include: {
        nursery: {
          select: {
            name: true,
          },
        },
      },
    });

    return {
      ...plant,
      averageRating: Math.round(averageRating * 10) / 10,
      totalReviews: plant._count.reviews,
      totalRentals: plant._count.rentals,
      totalPurchases: plant._count.purchases,
      relatedPlants,
    };
  }

  async search(searchDto: PlantSearchDto) {
    const { q, ...filterDto } = searchDto;

    if (!q || q.length < 2) {
      throw new BadRequestException(
        "Search query must be at least 2 characters"
      );
    }

    const searchTerms = q
      .toLowerCase()
      .split(" ")
      .filter((term) => term.length > 0);

    const where: Prisma.PlantWhereInput = {
      isActive: true,
      AND: searchTerms.map((term) => ({
        OR: [
          { name: { contains: term, mode: "insensitive" } },
          { description: { contains: term, mode: "insensitive" } },
          { scientificName: { contains: term, mode: "insensitive" } },
          { careInstructions: { contains: term, mode: "insensitive" } },
          {
            nursery: {
              name: { contains: term, mode: "insensitive" },
            },
          },
        ],
      })),
      // Apply additional filters
      ...(filterDto.category && { category: filterDto.category }),
      ...(filterDto.size && { size: filterDto.size }),
      ...(filterDto.careLevel && { careLevel: filterDto.careLevel }),
      ...(filterDto.lightRequirement && {
        lightRequirement: filterDto.lightRequirement,
      }),
      ...(filterDto.isPetSafe !== undefined && {
        isPetSafe: filterDto.isPetSafe,
      }),
      ...(filterDto.isIndoor !== undefined && { isIndoor: filterDto.isIndoor }),
      ...(filterDto.available && { availableStock: { gt: 0 } }),
      ...(filterDto.nurseryId && { nurseryId: filterDto.nurseryId }),
    };

    const skip = ((filterDto.page || 1) - 1) * (filterDto.limit || 20);

    const [plants, total] = await this.prisma.$transaction([
      this.prisma.plant.findMany({
        where,
        skip,
        take: filterDto.limit || 20,
        include: {
          nursery: {
            select: {
              id: true,
              name: true,
              city: true,
              rating: true,
              logo: true,
            },
          },
          _count: {
            select: {
              reviews: true,
            },
          },
        },
        orderBy: {
          name: "desc", // Change to a valid property
        },
      }),
      this.prisma.plant.count({ where }),
    ]);

    const totalPages = Math.ceil(total / (filterDto.limit || 20));

    return {
      data: plants,
      total,
      page: filterDto.page || 1,
      limit: filterDto.limit || 20,
      totalPages,
      hasNext: (filterDto.page || 1) < totalPages,
      hasPrevious: (filterDto.page || 1) > 1,
      searchQuery: q,
    };
  }

  async getCategories() {
    // Get all categories with counts
    const categories = await this.prisma.plant.groupBy({
      by: ["category"],
      where: {
        isActive: true,
      },
      _count: {
        category: true,
      },
      orderBy: {
        _count: {
          category: "desc",
        },
      },
    });

    // Map to user-friendly format
    const categoryMap: Record<PlantCategory, { label: string; icon: string }> =
      {
        INDOOR: { label: "Indoor Plants", icon: "🌿" },
        OUTDOOR: { label: "Outdoor Plants", icon: "🌳" },
        SUCCULENTS: { label: "Succulents", icon: "🌵" },
        FLOWERING: { label: "Flowering Plants", icon: "🌺" },
        FOLIAGE: { label: "Foliage Plants", icon: "🍃" },
        HERBS: { label: "Herbs", icon: "🌱" },
        TREES: { label: "Trees", icon: "🌲" },
        SHRUBS: { label: "Shrubs", icon: "🌾" },
      };

    return categories.map((cat) => ({
      value: cat.category,
      label: categoryMap[cat.category].label,
      icon: categoryMap[cat.category].icon,
      count: cat._count.category,
    }));
  }

  async getFeaturedPlants() {
    const plants = await this.prisma.plant.findMany({
      where: {
        isActive: true,
        isFeatured: true,
        availableStock: { gt: 0 },
      },
      take: 10,
      include: {
        nursery: {
          select: {
            id: true,
            name: true,
            city: true,
            rating: true,
          },
        },
        _count: {
          select: {
            reviews: true,
          },
        },
      },
      orderBy: {
        updatedAt: "desc",
      },
    });

    return plants;
  }

  async getPopularPlants() {
    const plants = await this.prisma.plant.findMany({
      where: {
        isActive: true,
        availableStock: { gt: 0 },
      },
      take: 10,
      include: {
        nursery: {
          select: {
            id: true,
            name: true,
            city: true,
            rating: true,
          },
        },
        _count: {
          select: {
            reviews: true,
            rentals: true,
          },
        },
      },
      orderBy: {
        rentals: {
          _count: "desc",
        },
      },
    });

    return plants;
  }
}
