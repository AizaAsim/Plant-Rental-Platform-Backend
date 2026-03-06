import {
    PrismaClient,
    UserRole,
    MaintenanceLevel,
    SunlightRequirement,
    WaterFrequency,
    FeatureType,
    InteractionType,
    ReviewableType,
  } from "@prisma/client";
  import * as bcrypt from "bcrypt";
  import { Decimal } from "@prisma/client/runtime/library";
  
  const prisma = new PrismaClient();
  
  async function main() {
    console.log("🌱 Starting seed...");
  
    // ─── Clean existing data (FK order) ──────────────────────────────────────
    await prisma.cartPackageItem.deleteMany();
    await prisma.customPlantPackageItem.deleteMany();
    await prisma.customPlantPackage.deleteMany();
    await prisma.plantPackageItem.deleteMany();
    await prisma.plantPackage.deleteMany();
    await prisma.userPlantInteraction.deleteMany();
    await prisma.featuredPlant.deleteMany();
    await prisma.wishlist.deleteMany();
    await prisma.reviewImage.deleteMany();
    await prisma.review.deleteMany();
    await prisma.plantTagMapping.deleteMany();
    await prisma.plantTag.deleteMany();
    await prisma.plantImage.deleteMany();
    await prisma.plant.deleteMany();
    await prisma.nurseryServiceArea.deleteMany();
    await prisma.nurseryWorkingHours.deleteMany();
    await prisma.nurseryImage.deleteMany();
    await prisma.nursery.deleteMany();
    await prisma.plantCategory.deleteMany();
    await prisma.refreshToken.deleteMany();
    await prisma.user.deleteMany();
  
    console.log("🗑️  Cleared existing data");
  
    // ─── Users ────────────────────────────────────────────────────────────────
    const passwordHash = await bcrypt.hash("Password123!", 10);
  
    const adminUser = await prisma.user.create({
      data: {
        email: "admin@plantrent.com",
        phone: "+923001234567",
        passwordHash,
        fullName: "Admin User",
        role: UserRole.ADMIN,
        isVerified: true,
        isActive: true,
      },
    });
  
    const vendorUser1 = await prisma.user.create({
      data: {
        email: "vendor1@plantrent.com",
        phone: "+923011234567",
        passwordHash,
        fullName: "Ali Hassan",
        role: UserRole.VENDOR,
        isVerified: true,
        isActive: true,
      },
    });
  
    const vendorUser2 = await prisma.user.create({
      data: {
        email: "vendor2@plantrent.com",
        phone: "+923021234567",
        passwordHash,
        fullName: "Sara Khan",
        role: UserRole.VENDOR,
        isVerified: true,
        isActive: true,
      },
    });
  
    const customer1 = await prisma.user.create({
      data: {
        email: "customer1@example.com",
        phone: "+923031234567",
        passwordHash,
        fullName: "Ahmed Raza",
        role: UserRole.USER,
        isVerified: true,
        isActive: true,
      },
    });
  
    const customer2 = await prisma.user.create({
      data: {
        email: "customer2@example.com",
        phone: "+923041234567",
        passwordHash,
        fullName: "Fatima Malik",
        role: UserRole.USER,
        isVerified: true,
        isActive: true,
      },
    });
  
    console.log("👤 Users created");
  
    // ─── Plant Categories ─────────────────────────────────────────────────────
    // Note: PlantCategory has: id, name, slug, description, imageUrl, parentId, isActive, createdAt
    const catIndoor = await prisma.plantCategory.create({
      data: {
        name: "Indoor Plants",
        slug: "indoor-plants",
        description: "Perfect plants for your home and office interiors",
        isActive: true,
      },
    });
  
    const catOutdoor = await prisma.plantCategory.create({
      data: {
        name: "Outdoor Plants",
        slug: "outdoor-plants",
        description: "Beautiful plants for gardens, balconies and patios",
        isActive: true,
      },
    });
  
    const catSucculents = await prisma.plantCategory.create({
      data: {
        name: "Succulents & Cacti",
        slug: "succulents-cacti",
        description: "Low maintenance, drought-tolerant beauties",
        isActive: true,
      },
    });
  
    const catFlowering = await prisma.plantCategory.create({
      data: {
        name: "Flowering Plants",
        slug: "flowering-plants",
        description: "Add a pop of color to any space",
        isActive: true,
      },
    });
  
    const catHerbs = await prisma.plantCategory.create({
      data: {
        name: "Herbs & Edibles",
        slug: "herbs-edibles",
        description: "Grow your own kitchen garden",
        isActive: true,
      },
    });
  
    const catFoliage = await prisma.plantCategory.create({
      data: {
        name: "Foliage Plants",
        slug: "foliage-plants",
        description: "Stunning leaf textures and colors",
        isActive: true,
      },
    });
  
    const catAirPurifying = await prisma.plantCategory.create({
      data: {
        name: "Air Purifying",
        slug: "air-purifying",
        description: "NASA-approved plants that clean your air",
        isActive: true,
      },
    });
  
    const catBonsai = await prisma.plantCategory.create({
      data: {
        name: "Bonsai",
        slug: "bonsai",
        description: "Miniature trees, a living art form",
        isActive: true,
      },
    });
  
    console.log("📂 Categories created");
  
    // ─── Plant Tags ───────────────────────────────────────────────────────────
    // Schema model is PlantTag (not Tag), relation is PlantTagMapping
    const tagNames = [
      "air-purifying", "low-light", "pet-friendly", "drought-tolerant",
      "fast-growing", "low-maintenance", "flowering", "fragrant",
      "indoor", "outdoor", "tropical", "succulent",
      "spring", "summer", "autumn", "winter",
      "office-friendly", "beginner-friendly", "rare", "statement-plant",
    ];
  
    const tags: Record<string, { id: string; name: string }> = {};
    for (const name of tagNames) {
      const tag = await prisma.plantTag.create({ data: { name } });
      tags[name] = tag;
    }
  
    console.log("🏷️  Tags created");
  
    // ─── Nurseries ────────────────────────────────────────────────────────────
    // NurseryWorkingHours uses `isClosed` (not `isOpen`)
    // NurseryServiceArea uses `city` (not `areaName`)
    // Nursery address fields: addressLine1, addressLine2 (not `address`)
    const nursery1 = await prisma.nursery.create({
      data: {
        vendorId: vendorUser1.id,
        name: "Green Paradise Nursery",
        slug: "green-paradise-nursery",
        description: "Karachi's finest plant nursery with over 500 varieties of indoor and outdoor plants.",
        email: "info@greenparadise.pk",
        phone: "+922134567890",
        addressLine1: "Plot 45, Block 7, Clifton",
        city: "Karachi",
        state: "Sindh",
        pincode: "75600",
        latitude: new Decimal(24.8138),
        longitude: new Decimal(67.0299),
        isActive: true,
        isVerified: true,
        ratingAvg: new Decimal(4.5),
        totalReviews: 128,
        workingHours: {
          create: [
            { dayOfWeek: 1, openTime: "09:00", closeTime: "20:00", isClosed: false },
            { dayOfWeek: 2, openTime: "09:00", closeTime: "20:00", isClosed: false },
            { dayOfWeek: 3, openTime: "09:00", closeTime: "20:00", isClosed: false },
            { dayOfWeek: 4, openTime: "09:00", closeTime: "20:00", isClosed: false },
            { dayOfWeek: 5, openTime: "09:00", closeTime: "20:00", isClosed: false },
            { dayOfWeek: 6, openTime: "10:00", closeTime: "18:00", isClosed: false },
            { dayOfWeek: 0, isClosed: true },
          ],
        },
        serviceAreas: {
          create: [
            { pincode: "75600", city: "Clifton" },
            { pincode: "75500", city: "DHA" },
            { pincode: "75400", city: "Gulshan-e-Iqbal" },
            { pincode: "75300", city: "North Nazimabad" },
          ],
        },
      },
    });
  
    const nursery2 = await prisma.nursery.create({
      data: {
        vendorId: vendorUser2.id,
        name: "Urban Jungle PK",
        slug: "urban-jungle-pk",
        description: "Bringing the jungle to your urban space. Specializing in rare and exotic tropical plants.",
        email: "hello@urbanjungle.pk",
        phone: "+922145678901",
        addressLine1: "Shop 12, Zamzama Commercial Lane 4",
        city: "Karachi",
        state: "Sindh",
        pincode: "75500",
        latitude: new Decimal(24.8274),
        longitude: new Decimal(67.0531),
        isActive: true,
        isVerified: true,
        ratingAvg: new Decimal(4.8),
        totalReviews: 89,
        workingHours: {
          create: [
            { dayOfWeek: 0, openTime: "12:00", closeTime: "17:00", isClosed: false },
            { dayOfWeek: 1, openTime: "10:00", closeTime: "21:00", isClosed: false },
            { dayOfWeek: 2, openTime: "10:00", closeTime: "21:00", isClosed: false },
            { dayOfWeek: 3, openTime: "10:00", closeTime: "21:00", isClosed: false },
            { dayOfWeek: 4, openTime: "10:00", closeTime: "21:00", isClosed: false },
            { dayOfWeek: 5, openTime: "10:00", closeTime: "21:00", isClosed: false },
            { dayOfWeek: 6, openTime: "11:00", closeTime: "19:00", isClosed: false },
          ],
        },
        serviceAreas: {
          create: [
            { pincode: "75500", city: "DHA" },
            { pincode: "75600", city: "Clifton" },
            { pincode: "75700", city: "Bahadurabad" },
          ],
        },
      },
    });
  
    console.log("🏡 Nurseries created");
  
    // ─── Helper: create plant ─────────────────────────────────────────────────
    // WaterFrequency: DAILY | ALTERNATE_DAYS | WEEKLY | BIWEEKLY | MONTHLY  (no TWICE_WEEKLY)
    // SunlightRequirement: LOW | MEDIUM | HIGH | INDIRECT                   (no BRIGHT_INDIRECT)
    // MaintenanceLevel is required (not optional)
    // Tags use PlantTagMapping with tagId (not name-based connectOrCreate on Tag)
    async function createPlant(data: {
      nurseryId: string;
      categoryId: string;
      name: string;
      slug: string;
      scientificName?: string;
      description: string;
      careInstructions: string;
      sunlightRequirement?: SunlightRequirement;
      waterFrequency?: WaterFrequency;
      maintenanceLevel: MaintenanceLevel;
      isIndoor: boolean;
      isPetFriendly: boolean;
      heightCm?: number;
      rentPriceDaily?: number;
      rentPriceWeekly?: number;
      rentPriceMonthly?: number;
      buyPrice?: number;
      depositAmount?: number;
      isAvailableForRent: boolean;
      isAvailableForSale: boolean;
      stockQuantity: number;
      images: string[];
      tagNames: string[];
      isFeatured?: boolean;
      ratingAvg?: number;
      totalReviews?: number;
    }) {
      return prisma.plant.create({
        data: {
          nurseryId: data.nurseryId,
          categoryId: data.categoryId,
          name: data.name,
          slug: data.slug,
          scientificName: data.scientificName,
          description: data.description,
          careInstructions: data.careInstructions,
          sunlightRequirement: data.sunlightRequirement,
          waterFrequency: data.waterFrequency,
          maintenanceLevel: data.maintenanceLevel,
          isIndoor: data.isIndoor,
          isPetFriendly: data.isPetFriendly,
          heightCm: data.heightCm,
          potIncluded: true,
          rentPriceDaily:    data.rentPriceDaily    ? new Decimal(data.rentPriceDaily)    : null,
          rentPriceWeekly:   data.rentPriceWeekly   ? new Decimal(data.rentPriceWeekly)   : null,
          rentPriceMonthly:  data.rentPriceMonthly  ? new Decimal(data.rentPriceMonthly)  : null,
          buyPrice:          data.buyPrice          ? new Decimal(data.buyPrice)          : null,
          depositAmount: new Decimal(data.depositAmount ?? 0),
          isAvailableForRent: data.isAvailableForRent,
          isAvailableForSale: data.isAvailableForSale,
          stockQuantity: data.stockQuantity,
          minRentDays: 7,
          maxRentDays: 365,
          isActive: true,
          isFeatured: data.isFeatured ?? false,
          ratingAvg:    new Decimal(data.ratingAvg    ?? 0),
          totalReviews: data.totalReviews ?? 0,
          images: {
            create: data.images.map((url, i) => ({
              imageUrl: url,
              isPrimary: i === 0,
              displayOrder: i,
            })),
          },
          tags: {
            create: data.tagNames
              .filter((t) => tags[t])
              .map((t) => ({ tagId: tags[t].id })),
          },
        },
      });
    }
  
    // ─── Plants — Nursery 1 (Green Paradise) ─────────────────────────────────
  
    const monstera = await createPlant({
      nurseryId: nursery1.id,
      categoryId: catIndoor.id,
      name: "Monstera Deliciosa",
      slug: "monstera-deliciosa",
      scientificName: "Monstera deliciosa",
      description: "The iconic Swiss cheese plant with dramatic split leaves. A statement piece for any room.",
      careInstructions: "Water when top 2–3cm of soil feels dry. Wipe leaves monthly. Feed monthly in growing season.",
      sunlightRequirement: SunlightRequirement.MEDIUM,
      waterFrequency: WaterFrequency.WEEKLY,
      maintenanceLevel: MaintenanceLevel.LOW,
      isIndoor: true,
      isPetFriendly: false,
      heightCm: 80,
      rentPriceDaily: 150,
      rentPriceWeekly: 800,
      rentPriceMonthly: 2500,
      buyPrice: 3500,
      depositAmount: 1500,
      isAvailableForRent: true,
      isAvailableForSale: true,
      stockQuantity: 15,
      images: ["https://images.unsplash.com/photo-1614594975525-e45190c55d0b?w=800"],
      tagNames: ["indoor", "low-light", "statement-plant", "tropical", "air-purifying"],
      isFeatured: true,
      ratingAvg: 4.8,
      totalReviews: 42,
    });
  
    const snakePlant = await createPlant({
      nurseryId: nursery1.id,
      categoryId: catAirPurifying.id,
      name: "Snake Plant",
      slug: "snake-plant",
      scientificName: "Sansevieria trifasciata",
      description: "Nearly indestructible and one of the best air purifiers. Thrives on neglect.",
      careInstructions: "Water every 2–6 weeks. Tolerates low light. Avoid overwatering — the #1 killer.",
      sunlightRequirement: SunlightRequirement.LOW,
      waterFrequency: WaterFrequency.MONTHLY,
      maintenanceLevel: MaintenanceLevel.LOW,
      isIndoor: true,
      isPetFriendly: false,
      heightCm: 60,
      rentPriceDaily: 80,
      rentPriceWeekly: 450,
      rentPriceMonthly: 1200,
      buyPrice: 1800,
      depositAmount: 800,
      isAvailableForRent: true,
      isAvailableForSale: true,
      stockQuantity: 25,
      images: ["https://images.unsplash.com/photo-1599598425947-5202edd56bdb?w=800"],
      tagNames: ["indoor", "low-light", "air-purifying", "beginner-friendly", "low-maintenance", "office-friendly"],
      isFeatured: true,
      ratingAvg: 4.9,
      totalReviews: 67,
    });
  
    const peaceLily = await createPlant({
      nurseryId: nursery1.id,
      categoryId: catFlowering.id,
      name: "Peace Lily",
      slug: "peace-lily",
      scientificName: "Spathiphyllum wallisii",
      description: "Elegant white flowers and glossy leaves. One of the few flowering plants that thrives in low light.",
      careInstructions: "Keep soil moist but not soggy. Mist leaves regularly. Fertilize every 6 weeks in spring/summer.",
      sunlightRequirement: SunlightRequirement.LOW,
      waterFrequency: WaterFrequency.ALTERNATE_DAYS,
      maintenanceLevel: MaintenanceLevel.LOW,
      isIndoor: true,
      isPetFriendly: false,
      heightCm: 50,
      rentPriceDaily: 100,
      rentPriceWeekly: 550,
      rentPriceMonthly: 1500,
      buyPrice: 2200,
      depositAmount: 1000,
      isAvailableForRent: true,
      isAvailableForSale: true,
      stockQuantity: 18,
      images: ["https://images.unsplash.com/photo-1592150621744-aca64f48394a?w=800"],
      tagNames: ["indoor", "low-light", "flowering", "air-purifying", "office-friendly"],
      ratingAvg: 4.6,
      totalReviews: 31,
    });
  
    const rubberPlant = await createPlant({
      nurseryId: nursery1.id,
      categoryId: catFoliage.id,
      name: "Rubber Plant",
      slug: "rubber-plant",
      scientificName: "Ficus elastica",
      description: "Bold, glossy leaves in deep burgundy and green. A classic houseplant that makes a bold statement.",
      careInstructions: "Water when top inch of soil is dry. Bright indirect light. Wipe leaves with a damp cloth.",
      sunlightRequirement: SunlightRequirement.MEDIUM,
      waterFrequency: WaterFrequency.WEEKLY,
      maintenanceLevel: MaintenanceLevel.LOW,
      isIndoor: true,
      isPetFriendly: false,
      heightCm: 90,
      rentPriceDaily: 120,
      rentPriceWeekly: 700,
      rentPriceMonthly: 1800,
      buyPrice: 2800,
      depositAmount: 1200,
      isAvailableForRent: true,
      isAvailableForSale: true,
      stockQuantity: 12,
      images: ["https://images.unsplash.com/photo-1598880940080-ff9a29891b85?w=800"],
      tagNames: ["indoor", "statement-plant", "tropical", "beginner-friendly"],
      ratingAvg: 4.5,
      totalReviews: 28,
    });
  
    const pothos = await createPlant({
      nurseryId: nursery1.id,
      categoryId: catIndoor.id,
      name: "Golden Pothos",
      slug: "golden-pothos",
      scientificName: "Epipremnum aureum",
      description: "The ultimate beginner plant. Trailing vines with heart-shaped golden-green leaves.",
      careInstructions: "Water every 1–2 weeks. Tolerates low light but thrives in medium indirect light.",
      sunlightRequirement: SunlightRequirement.LOW,
      waterFrequency: WaterFrequency.WEEKLY,
      maintenanceLevel: MaintenanceLevel.LOW,
      isIndoor: true,
      isPetFriendly: false,
      heightCm: 30,
      rentPriceDaily: 60,
      rentPriceWeekly: 300,
      rentPriceMonthly: 800,
      buyPrice: 900,
      depositAmount: 400,
      isAvailableForRent: true,
      isAvailableForSale: true,
      stockQuantity: 30,
      images: ["https://images.unsplash.com/photo-1600411833196-7c1f6b1a8b90?w=800"],
      tagNames: ["indoor", "low-light", "beginner-friendly", "low-maintenance", "air-purifying", "fast-growing"],
      isFeatured: true,
      ratingAvg: 4.7,
      totalReviews: 55,
    });
  
    const echeveria = await createPlant({
      nurseryId: nursery1.id,
      categoryId: catSucculents.id,
      name: "Echeveria",
      slug: "echeveria",
      scientificName: "Echeveria elegans",
      description: "A rosette-shaped succulent with beautiful powdery blue-green leaves.",
      careInstructions: "Water sparingly — only when soil is completely dry. Full sun to bright indirect light.",
      sunlightRequirement: SunlightRequirement.HIGH,
      waterFrequency: WaterFrequency.MONTHLY,
      maintenanceLevel: MaintenanceLevel.LOW,
      isIndoor: true,
      isPetFriendly: true,
      heightCm: 15,
      rentPriceDaily: 40,
      rentPriceWeekly: 200,
      rentPriceMonthly: 500,
      buyPrice: 600,
      depositAmount: 200,
      isAvailableForRent: true,
      isAvailableForSale: true,
      stockQuantity: 40,
      images: ["https://images.unsplash.com/photo-1459411552884-841db9b3cc2a?w=800"],
      tagNames: ["indoor", "succulent", "pet-friendly", "drought-tolerant", "low-maintenance", "beginner-friendly"],
      ratingAvg: 4.4,
      totalReviews: 19,
    });
  
    // ─── Plants — Nursery 2 (Urban Jungle) ───────────────────────────────────
  
    const birdOfParadise = await createPlant({
      nurseryId: nursery2.id,
      categoryId: catIndoor.id,
      name: "Bird of Paradise",
      slug: "bird-of-paradise",
      scientificName: "Strelitzia reginae",
      description: "Dramatic, large paddle-shaped leaves that bring a tropical resort feel to any space.",
      careInstructions: "Water thoroughly, allow top 50% of soil to dry out. Needs bright light to thrive.",
      sunlightRequirement: SunlightRequirement.HIGH,
      waterFrequency: WaterFrequency.WEEKLY,
      maintenanceLevel: MaintenanceLevel.MEDIUM,
      isIndoor: true,
      isPetFriendly: false,
      heightCm: 150,
      rentPriceDaily: 250,
      rentPriceWeekly: 1400,
      rentPriceMonthly: 4000,
      buyPrice: 6500,
      depositAmount: 2500,
      isAvailableForRent: true,
      isAvailableForSale: true,
      stockQuantity: 8,
      images: ["https://images.unsplash.com/photo-1520412099551-62b6bafeb5bb?w=800"],
      tagNames: ["indoor", "tropical", "statement-plant", "rare"],
      isFeatured: true,
      ratingAvg: 4.9,
      totalReviews: 23,
    });
  
    const fiddleLeaf = await createPlant({
      nurseryId: nursery2.id,
      categoryId: catIndoor.id,
      name: "Fiddle Leaf Fig",
      slug: "fiddle-leaf-fig",
      scientificName: "Ficus lyrata",
      description: "The most coveted houseplant in interior design. Large, violin-shaped leaves on an elegant trunk.",
      careInstructions: "Consistent watering schedule is key. Bright indirect light. Avoid moving it around.",
      sunlightRequirement: SunlightRequirement.HIGH,
      waterFrequency: WaterFrequency.WEEKLY,
      maintenanceLevel: MaintenanceLevel.HIGH,
      isIndoor: true,
      isPetFriendly: false,
      heightCm: 120,
      rentPriceDaily: 300,
      rentPriceWeekly: 1800,
      rentPriceMonthly: 5000,
      buyPrice: 8000,
      depositAmount: 3000,
      isAvailableForRent: true,
      isAvailableForSale: true,
      stockQuantity: 6,
      images: ["https://images.unsplash.com/photo-1545239705-1564e58b9e4a?w=800"],
      tagNames: ["indoor", "statement-plant", "tropical", "rare"],
      isFeatured: true,
      ratingAvg: 4.6,
      totalReviews: 18,
    });
  
    const zzPlant = await createPlant({
      nurseryId: nursery2.id,
      categoryId: catAirPurifying.id,
      name: "ZZ Plant",
      slug: "zz-plant",
      scientificName: "Zamioculcas zamiifolia",
      description: "Virtually indestructible with stunning glossy dark-green leaves. Thrives in neglect.",
      careInstructions: "Water every 2–3 weeks. Tolerates very low light. Do not overwater.",
      sunlightRequirement: SunlightRequirement.LOW,
      waterFrequency: WaterFrequency.MONTHLY,
      maintenanceLevel: MaintenanceLevel.LOW,
      isIndoor: true,
      isPetFriendly: false,
      heightCm: 70,
      rentPriceDaily: 100,
      rentPriceWeekly: 550,
      rentPriceMonthly: 1400,
      buyPrice: 2000,
      depositAmount: 800,
      isAvailableForRent: true,
      isAvailableForSale: true,
      stockQuantity: 20,
      images: ["https://images.unsplash.com/photo-1632207691143-643e2a9a9361?w=800"],
      tagNames: ["indoor", "low-light", "beginner-friendly", "low-maintenance", "office-friendly", "air-purifying"],
      ratingAvg: 4.8,
      totalReviews: 35,
    });
  
    const lavender = await createPlant({
      nurseryId: nursery2.id,
      categoryId: catOutdoor.id,
      name: "English Lavender",
      slug: "english-lavender",
      scientificName: "Lavandula angustifolia",
      description: "Fragrant purple spikes that attract bees and butterflies. Perfect for balconies and gardens.",
      careInstructions: "Full sun. Water when soil is dry. Prune after flowering to keep compact.",
      sunlightRequirement: SunlightRequirement.HIGH,
      waterFrequency: WaterFrequency.ALTERNATE_DAYS,
      maintenanceLevel: MaintenanceLevel.LOW,
      isIndoor: false,
      isPetFriendly: true,
      heightCm: 40,
      rentPriceDaily: 80,
      rentPriceWeekly: 450,
      rentPriceMonthly: 1200,
      buyPrice: 1500,
      depositAmount: 600,
      isAvailableForRent: true,
      isAvailableForSale: true,
      stockQuantity: 22,
      images: ["https://images.unsplash.com/photo-1471086569966-db3eebc25a59?w=800"],
      tagNames: ["outdoor", "flowering", "fragrant", "pet-friendly", "summer"],
      ratingAvg: 4.7,
      totalReviews: 29,
    });
  
    const basil = await createPlant({
      nurseryId: nursery2.id,
      categoryId: catHerbs.id,
      name: "Sweet Basil",
      slug: "sweet-basil",
      scientificName: "Ocimum basilicum",
      description: "Fresh culinary basil for your kitchen. Fragrant and delicious in pasta, pizza and salads.",
      careInstructions: "Full sun or bright light. Keep moist. Pinch off flowers to extend harvest.",
      sunlightRequirement: SunlightRequirement.HIGH,
      waterFrequency: WaterFrequency.ALTERNATE_DAYS,
      maintenanceLevel: MaintenanceLevel.MEDIUM,
      isIndoor: false,
      isPetFriendly: true,
      heightCm: 30,
      buyPrice: 400,
      isAvailableForRent: false,
      isAvailableForSale: true,
      stockQuantity: 35,
      images: ["https://images.unsplash.com/photo-1618375569909-3c8616cf7733?w=800"],
      tagNames: ["outdoor", "pet-friendly", "fragrant", "beginner-friendly", "summer"],
      ratingAvg: 4.3,
      totalReviews: 14,
    });
  
    console.log("🌿 Plants created");
  
    // ─── Featured Plants ──────────────────────────────────────────────────────
    // FeatureType: TRENDING | SEASONAL | EDITOR_PICK | NEW_ARRIVAL (no HOMEPAGE_HERO / STAFF_PICK)
    const featuredData = [
      { plantId: monstera.id,       type: FeatureType.EDITOR_PICK,  order: 1 },
      { plantId: birdOfParadise.id, type: FeatureType.EDITOR_PICK,  order: 2 },
      { plantId: fiddleLeaf.id,     type: FeatureType.EDITOR_PICK,  order: 3 },
      { plantId: snakePlant.id,     type: FeatureType.TRENDING,     order: 1 },
      { plantId: pothos.id,         type: FeatureType.TRENDING,     order: 2 },
      { plantId: zzPlant.id,        type: FeatureType.TRENDING,     order: 3 },
      { plantId: echeveria.id,      type: FeatureType.NEW_ARRIVAL,  order: 1 },
      { plantId: lavender.id,       type: FeatureType.SEASONAL,     order: 1 },
      { plantId: peaceLily.id,      type: FeatureType.SEASONAL,     order: 2 },
    ];
  
    for (const fp of featuredData) {
      await prisma.featuredPlant.create({
        data: {
          plantId: fp.plantId,
          featureType: fp.type,
          displayOrder: fp.order,
          isActive: true,
          startDate: new Date(),
          endDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        },
      });
    }
  
    console.log("⭐ Featured plants created");
  
    // ─── Reviews ──────────────────────────────────────────────────────────────
    // unique: [userId, reviewableType, reviewableId, orderId]
    // orderId null is fine — PostgreSQL treats NULLs as distinct in unique indexes
    const reviewData = [
      {
        userId: customer1.id,
        plantId: monstera.id,
        rating: 5,
        title: "Absolutely stunning!",
        comment: "The monstera arrived in perfect condition. It's become the centrepiece of my living room.",
      },
      {
        userId: customer2.id,
        plantId: monstera.id,
        rating: 4,
        title: "Great plant, good delivery",
        comment: "Healthy and well-rooted. One leaf had a small tear but overall very happy.",
      },
      {
        userId: customer1.id,
        plantId: snakePlant.id,
        rating: 5,
        title: "Perfect office plant",
        comment: "Been 3 months and it still looks great with minimal care.",
      },
      {
        userId: customer2.id,
        plantId: pothos.id,
        rating: 5,
        title: "Love it!",
        comment: "Growing like crazy, looks so lush. Great value for money.",
      },
      {
        userId: customer1.id,
        plantId: birdOfParadise.id,
        rating: 5,
        title: "Wow factor is real",
        comment: "This plant completely transformed my living space. Worth every rupee.",
      },
    ];
  
    for (const r of reviewData) {
      await prisma.review.create({
        data: {
          userId: r.userId,
          reviewableType: ReviewableType.PLANT,
          reviewableId: r.plantId,
          rating: r.rating,
          title: r.title,
          comment: r.comment,
          isVerifiedPurchase: false,
          isActive: true,
        },
      });
    }
  
    console.log("✍️  Reviews created");
  
    // ─── User Plant Interactions ───────────────────────────────────────────────
    const interactionData = [
      { userId: customer1.id, plantId: monstera.id,       type: InteractionType.VIEW },
      { userId: customer1.id, plantId: monstera.id,       type: InteractionType.WISHLIST },
      { userId: customer1.id, plantId: snakePlant.id,     type: InteractionType.VIEW },
      { userId: customer1.id, plantId: pothos.id,         type: InteractionType.WISHLIST },
      { userId: customer1.id, plantId: zzPlant.id,        type: InteractionType.VIEW },
      { userId: customer2.id, plantId: birdOfParadise.id, type: InteractionType.VIEW },
      { userId: customer2.id, plantId: birdOfParadise.id, type: InteractionType.WISHLIST },
      { userId: customer2.id, plantId: fiddleLeaf.id,     type: InteractionType.VIEW },
      { userId: customer2.id, plantId: pothos.id,         type: InteractionType.VIEW },
      { userId: customer2.id, plantId: lavender.id,       type: InteractionType.VIEW },
    ];
  
    for (const i of interactionData) {
      await prisma.userPlantInteraction.create({
        data: {
          userId: i.userId,
          plantId: i.plantId,
          interactionType: i.type,
        },
      });
    }
  
    console.log("👆 Interactions created");
  
    console.log(`
  ✅ Seed complete!
  
  📧 Test accounts (password: Password123!):
     Admin:    admin@plantrent.com
     Vendor 1: vendor1@plantrent.com  → Green Paradise Nursery
     Vendor 2: vendor2@plantrent.com  → Urban Jungle PK
     Customer: customer1@example.com
     Customer: customer2@example.com
  
  📂 8 categories | 20 tags | 2 nurseries | 11 plants | 5 reviews
    `);
  }
  
  main()
    .catch((e) => {
      console.error("❌ Seed failed:", e);
      process.exit(1);
    })
    .finally(async () => {
      await prisma.$disconnect();
    });