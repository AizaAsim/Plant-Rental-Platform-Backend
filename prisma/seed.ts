import {
  PrismaClient,
  UserRole,
  MaintenanceLevel,
  SunlightRequirement,
  WaterFrequency,
  FeatureType,
  InteractionType,
  ReviewableType,
  OrderType,
  OrderStatus,
  PaymentStatus,
  PaymentType,
  TransactionStatus,
  RentalStatus,
  ServiceType,
  BookingStatus,
  TaskType,
  TaskStatus,
  TaskPriority,
  TaskImageType,
  NotificationType,
  DevicePlatform,
  DiscountType,
  ApplicableFor,
  AccountType,
  DisputeType,
  DisputeStatus,
  EarningStatus,
  EarningType,
  PayoutStatus,
  RecipientType,
  DiagnosisSeverity,
  ChatRole,
  FreelanceJobStatus,
  InvitationStatus,
} from "@prisma/client";
import { Decimal } from "@prisma/client/runtime/library";
import * as bcrypt from "bcrypt";

const prisma = new PrismaClient();

const PASSWORD = "Password123!";
const IMG = {
  nurseryLogo: "https://images.unsplash.com/photo-1416879595882-3373a0480b5b?w=400",
  nurseryCover: "https://images.unsplash.com/photo-1466692476867-aef1dfb1e735?w=1200",
  avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200",
  plant: (id: string) =>
    `https://images.unsplash.com/${id}?w=800&q=80`,
};

function money(n: number): Decimal {
  return new Decimal(n);
}

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
}

function daysFromNow(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
}

function dateOnly(d: Date): Date {
  return new Date(d.toISOString().slice(0, 10));
}

async function clearDatabase() {
  const tables: Array<keyof PrismaClient> = [
    "idempotencyRecord",
    "cartPackageItem",
    "cartItem",
    "cart",
    "customPlantPackageItem",
    "customPlantPackage",
    "plantPackageItem",
    "plantPackage",
    "couponUsage",
    "disputeMessage",
    "dispute",
    "taskImage",
    "maintenanceTask",
    "rentalExtension",
    "orderItem",
    "orderPenalty",
    "manualInterventionOrder",
    "payment",
    "vendorEarning",
    "gardenerEarning",
    "payout",
    "freelanceJob",
    "order",
    "serviceBooking",
    "reviewImage",
    "review",
    "userPlantInteraction",
    "featuredPlant",
    "wishlist",
    "plantDiagnosis",
    "chatMessage",
    "chatSession",
    "notification",
    "deviceToken",
    "bankDetail",
    "nurseryInvitation",
    "gardenerAvailability",
    "gardenerServiceArea",
    "gardenerSkillMapping",
    "gardener",
    "vendorPackage",
    "plantTagMapping",
    "plantImage",
    "plant",
    "nurseryServiceArea",
    "nurseryWorkingHours",
    "nurseryImage",
    "nursery",
    "plantCategory",
    "plantTag",
    "coupon",
    "platformSetting",
    "userRecommendationPreference",
    "otpVerification",
    "refreshToken",
    "freelanceMatchConfig",
    "user",
  ];

  for (const table of tables) {
    // @ts-expect-error dynamic delegate
    await prisma[table].deleteMany();
  }
}

async function main() {
  console.log("🌱 Plant Rental Platform — seed starting…");
  await clearDatabase();
  console.log("🗑️  Database cleared");

  const passwordHash = await bcrypt.hash(PASSWORD, 10);

  // ─── Users ─────────────────────────────────────────────────────────────────
  const admin = await prisma.user.create({
    data: {
      email: "admin@plantrent.com",
      phone: "+923001234567",
      passwordHash,
      fullName: "Admin User",
      avatarUrl: IMG.avatar,
      role: UserRole.ADMIN,
      isVerified: true,
      isActive: true,
      lastLoginAt: daysAgo(1),
    },
  });

  const vendor1 = await prisma.user.create({
    data: {
      email: "vendor1@plantrent.com",
      phone: "+923011234567",
      passwordHash,
      fullName: "Ali Hassan",
      avatarUrl: IMG.avatar,
      role: UserRole.VENDOR,
      isVerified: true,
      isActive: true,
    },
  });

  const vendor2 = await prisma.user.create({
    data: {
      email: "vendor2@plantrent.com",
      phone: "+923021234567",
      passwordHash,
      fullName: "Sara Khan",
      avatarUrl: IMG.avatar,
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

  const corporate = await prisma.user.create({
    data: {
      email: "corporate@acme.pk",
      phone: "+923051234567",
      passwordHash,
      fullName: "Acme Offices Ltd",
      role: UserRole.USER,
      isCorporate: true,
      companyName: "Acme Offices Ltd",
      gstNumber: "PK-123456789",
      isVerified: true,
      isActive: true,
    },
  });

  const gardenerUser1 = await prisma.user.create({
    data: {
      email: "gardener1@plantrent.com",
      phone: "+923061234567",
      passwordHash,
      fullName: "Bilal Gardener",
      role: UserRole.GARDENER,
      isVerified: true,
      isActive: true,
    },
  });

  const gardenerUser2 = await prisma.user.create({
    data: {
      email: "freelancer@plantrent.com",
      phone: "+923071234567",
      passwordHash,
      fullName: "Nadia Freelance",
      role: UserRole.GARDENER,
      isVerified: true,
      isActive: true,
    },
  });

  console.log("👤 Users created (7)");

  // ─── Categories & tags ─────────────────────────────────────────────────────
  const categories = await Promise.all(
    [
      ["Indoor Plants", "indoor-plants", "Perfect for home and office"],
      ["Outdoor Plants", "outdoor-plants", "Gardens and balconies"],
      ["Succulents & Cacti", "succulents-cacti", "Low maintenance"],
      ["Flowering Plants", "flowering-plants", "Colorful blooms"],
      ["Herbs & Edibles", "herbs-edibles", "Kitchen garden"],
      ["Foliage Plants", "foliage-plants", "Leaf textures"],
      ["Air Purifying", "air-purifying", "NASA-approved cleaners"],
      ["Bonsai", "bonsai", "Miniature trees"],
    ].map(([name, slug, description]) =>
      prisma.plantCategory.create({ data: { name, slug, description, isActive: true } }),
    ),
  );
  const [catIndoor, catOutdoor, catSucculents, catFlowering, catHerbs, catFoliage, catAirPurifying] =
    categories;

  const tagNames = [
    "air-purifying", "low-light", "pet-friendly", "drought-tolerant",
    "fast-growing", "low-maintenance", "flowering", "fragrant",
    "indoor", "outdoor", "tropical", "succulent",
    "office-friendly", "beginner-friendly", "rare", "statement-plant",
  ];
  const tags: Record<string, { id: string }> = {};
  for (const name of tagNames) {
    tags[name] = await prisma.plantTag.create({ data: { name } });
  }

  console.log("📂 Categories & tags created");

  // ─── Nurseries ─────────────────────────────────────────────────────────────
  const nursery1 = await prisma.nursery.create({
    data: {
      vendorId: vendor1.id,
      name: "Green Paradise Nursery",
      slug: "green-paradise-nursery",
      description: "Karachi's finest plant nursery with 500+ varieties.",
      logoUrl: IMG.nurseryLogo,
      coverImageUrl: IMG.nurseryCover,
      email: "info@greenparadise.pk",
      phone: "+922134567890",
      addressLine1: "Plot 45, Block 7, Clifton",
      city: "Karachi",
      state: "Sindh",
      pincode: "75600",
      latitude: money(24.8138),
      longitude: money(67.0299),
      isActive: true,
      isVerified: true,
      ratingAvg: money(4.5),
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
        ],
      },
      images: {
        create: [
          { imageUrl: IMG.nurseryCover, displayOrder: 0 },
          { imageUrl: IMG.plant("photo-1466692476867-aef1dfb1e735"), displayOrder: 1 },
        ],
      },
    },
  });

  const nursery2 = await prisma.nursery.create({
    data: {
      vendorId: vendor2.id,
      name: "Urban Jungle PK",
      slug: "urban-jungle-pk",
      description: "Rare and exotic tropical plants for urban spaces.",
      logoUrl: IMG.nurseryLogo,
      coverImageUrl: IMG.plant("photo-1520412099551-62b6bafeb5bb"),
      email: "hello@urbanjungle.pk",
      phone: "+922145678901",
      addressLine1: "Shop 12, Zamzama Commercial Lane 4",
      city: "Karachi",
      state: "Sindh",
      pincode: "75500",
      latitude: money(24.8274),
      longitude: money(67.0531),
      isActive: true,
      isVerified: true,
      ratingAvg: money(4.8),
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
        ],
      },
      images: {
        create: [{ imageUrl: IMG.plant("photo-1520412099551-62b6bafeb5bb"), displayOrder: 0 }],
      },
    },
  });

  console.log("🏡 Nurseries created");

  // ─── Plants helper ─────────────────────────────────────────────────────────
  async function createPlant(opts: {
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
    imageUrls: string[];
    tagNames: string[];
    isFeatured?: boolean;
    ratingAvg?: number;
    totalReviews?: number;
  }) {
    return prisma.plant.create({
      data: {
        nurseryId: opts.nurseryId,
        categoryId: opts.categoryId,
        name: opts.name,
        slug: opts.slug,
        scientificName: opts.scientificName,
        description: opts.description,
        careInstructions: opts.careInstructions,
        sunlightRequirement: opts.sunlightRequirement,
        waterFrequency: opts.waterFrequency,
        maintenanceLevel: opts.maintenanceLevel,
        isIndoor: opts.isIndoor,
        isPetFriendly: opts.isPetFriendly,
        heightCm: opts.heightCm,
        potIncluded: true,
        rentPriceDaily: opts.rentPriceDaily != null ? money(opts.rentPriceDaily) : null,
        rentPriceWeekly: opts.rentPriceWeekly != null ? money(opts.rentPriceWeekly) : null,
        rentPriceMonthly: opts.rentPriceMonthly != null ? money(opts.rentPriceMonthly) : null,
        buyPrice: opts.buyPrice != null ? money(opts.buyPrice) : null,
        depositAmount: money(opts.depositAmount ?? 0),
        isAvailableForRent: opts.isAvailableForRent,
        isAvailableForSale: opts.isAvailableForSale,
        stockQuantity: opts.stockQuantity,
        isActive: true,
        isFeatured: opts.isFeatured ?? false,
        ratingAvg: money(opts.ratingAvg ?? 4.5),
        totalReviews: opts.totalReviews ?? 10,
        images: {
          create: opts.imageUrls.map((url, i) => ({
            imageUrl: url,
            isPrimary: i === 0,
            displayOrder: i,
          })),
        },
        tags: {
          create: opts.tagNames.filter((t) => tags[t]).map((t) => ({ tagId: tags[t].id })),
        },
      },
    });
  }

  const monstera = await createPlant({
    nurseryId: nursery1.id,
    categoryId: catIndoor.id,
    name: "Monstera Deliciosa",
    slug: "monstera-deliciosa",
    scientificName: "Monstera deliciosa",
    description: "Iconic Swiss cheese plant with dramatic split leaves.",
    careInstructions: "Water when top 2–3cm dry. Wipe leaves monthly.",
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
    imageUrls: [
      IMG.plant("photo-1614594975525-e45190c55d0b"),
      IMG.plant("photo-1598880940080-ff9a29891b85"),
    ],
    tagNames: ["indoor", "statement-plant", "tropical", "air-purifying"],
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
    description: "Nearly indestructible air purifier.",
    careInstructions: "Water every 2–6 weeks. Avoid overwatering.",
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
    imageUrls: [IMG.plant("photo-1599598425947-5202edd56bdb")],
    tagNames: ["indoor", "low-light", "air-purifying", "beginner-friendly", "office-friendly"],
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
    description: "Elegant white flowers, thrives in low light.",
    careInstructions: "Keep soil moist. Mist leaves regularly.",
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
    imageUrls: [IMG.plant("photo-1592150621744-aca64f48394a")],
    tagNames: ["indoor", "flowering", "air-purifying"],
    ratingAvg: 4.6,
    totalReviews: 31,
  });

  const pothos = await createPlant({
    nurseryId: nursery1.id,
    categoryId: catIndoor.id,
    name: "Golden Pothos",
    slug: "golden-pothos",
    scientificName: "Epipremnum aureum",
    description: "Ultimate beginner trailing plant.",
    careInstructions: "Water every 1–2 weeks.",
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
    imageUrls: [IMG.plant("photo-1600411833196-7c1f6b1a8b90")],
    tagNames: ["indoor", "beginner-friendly", "low-maintenance"],
    isFeatured: true,
    ratingAvg: 4.7,
    totalReviews: 55,
  });

  const birdOfParadise = await createPlant({
    nurseryId: nursery2.id,
    categoryId: catIndoor.id,
    name: "Bird of Paradise",
    slug: "bird-of-paradise",
    scientificName: "Strelitzia reginae",
    description: "Tropical resort vibes indoors.",
    careInstructions: "Bright light. Water when top 50% dry.",
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
    imageUrls: [IMG.plant("photo-1520412099551-62b6bafeb5bb")],
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
    description: "Interior design favourite.",
    careInstructions: "Consistent watering. Bright indirect light.",
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
    imageUrls: [IMG.plant("photo-1545239705-1564e58b9e4a")],
    tagNames: ["indoor", "statement-plant", "rare"],
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
    description: "Glossy leaves, thrives on neglect.",
    careInstructions: "Water every 2–3 weeks.",
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
    imageUrls: [IMG.plant("photo-1632207691143-643e2a9a9361")],
    tagNames: ["indoor", "office-friendly", "low-maintenance"],
    ratingAvg: 4.8,
    totalReviews: 35,
  });

  const lavender = await createPlant({
    nurseryId: nursery2.id,
    categoryId: catOutdoor.id,
    name: "English Lavender",
    slug: "english-lavender",
    scientificName: "Lavandula angustifolia",
    description: "Fragrant purple spikes for balconies.",
    careInstructions: "Full sun. Prune after flowering.",
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
    imageUrls: [IMG.plant("photo-1471086569966-db3eebc25a59")],
    tagNames: ["outdoor", "flowering", "fragrant", "pet-friendly"],
    ratingAvg: 4.7,
    totalReviews: 29,
  });

  const allPlants = [monstera, snakePlant, peaceLily, pothos, birdOfParadise, fiddleLeaf, zzPlant, lavender];
  console.log(`🌿 Plants created (${allPlants.length})`);

  // ─── Gardeners ─────────────────────────────────────────────────────────────
  const skillNames = ["Pruning", "Repotting", "Pest Control", "Plant Health", "Irrigation"];
  const skillMap: Record<string, string> = {};
  for (const name of skillNames) {
    const s = await prisma.gardenerSkill.create({ data: { name } });
    skillMap[name] = s.id;
  }

  const gardenerStaff = await prisma.gardener.create({
    data: {
      userId: gardenerUser1.id,
      nurseryId: nursery1.id,
      bio: "5 years maintaining corporate plant rentals.",
      experienceYears: 5,
      hourlyRate: money(1200),
      isFreelancer: false,
      isAvailable: true,
      isVerified: true,
      ratingAvg: money(4.7),
      totalReviews: 24,
      totalTasksCompleted: 89,
      staffRole: "Lead Gardener",
      skills: {
        create: [
          { skillId: skillMap["Pruning"] },
          { skillId: skillMap["Plant Health"] },
        ],
      },
      serviceAreas: { create: [{ pincode: "75600", city: "Clifton" }] },
      availability: {
        create: [
          { dayOfWeek: 1, startTime: "09:00", endTime: "17:00", isAvailable: true },
          { dayOfWeek: 3, startTime: "09:00", endTime: "17:00", isAvailable: true },
          { dayOfWeek: 5, startTime: "09:00", endTime: "15:00", isAvailable: true },
        ],
      },
    },
  });

  const gardenerFreelance = await prisma.gardener.create({
    data: {
      userId: gardenerUser2.id,
      bio: "Freelance plant care across Karachi.",
      experienceYears: 3,
      hourlyRate: money(1500),
      isFreelancer: true,
      isAvailable: true,
      isVerified: true,
      ratingAvg: money(4.9),
      totalReviews: 41,
      totalTasksCompleted: 112,
      skills: {
        create: [
          { skillId: skillMap["Repotting"] },
          { skillId: skillMap["Pest Control"] },
          { skillId: skillMap["Irrigation"] },
        ],
      },
      serviceAreas: {
        create: [
          { pincode: "75500", city: "DHA" },
          { pincode: "75600", city: "Clifton" },
        ],
      },
      availability: {
        create: [{ dayOfWeek: 2, startTime: "10:00", endTime: "18:00", isAvailable: true }],
      },
    },
  });

  await prisma.nurseryInvitation.create({
    data: {
      nurseryId: nursery2.id,
      gardenerId: gardenerFreelance.id,
      status: InvitationStatus.PENDING,
      message: "Join Urban Jungle as seasonal staff?",
      expiresAt: daysFromNow(14),
    },
  });

  console.log("🧑‍🌾 Gardeners created");

  // ─── Addresses ─────────────────────────────────────────────────────────────
  const addrC1Home = await prisma.userAddress.create({
    data: {
      userId: customer1.id,
      label: "Home",
      addressLine1: "Apartment 4B, Sea View Apartments",
      addressLine2: "Clifton Block 8",
      city: "Karachi",
      state: "Sindh",
      pincode: "75600",
      isDefault: true,
    },
  });

  const addrC1Office = await prisma.userAddress.create({
    data: {
      userId: customer1.id,
      label: "Office",
      addressLine1: "Floor 12, Business Plaza",
      city: "Karachi",
      state: "Sindh",
      pincode: "75500",
      isDefault: false,
    },
  });

  const addrC2 = await prisma.userAddress.create({
    data: {
      userId: customer2.id,
      label: "Home",
      addressLine1: "House 22, Street 5, DHA Phase 6",
      city: "Karachi",
      state: "Sindh",
      pincode: "75500",
      isDefault: true,
    },
  });

  const addrCorp = await prisma.userAddress.create({
    data: {
      userId: corporate.id,
      label: "HQ",
      addressLine1: "Acme Tower, I.I. Chundrigar Road",
      city: "Karachi",
      state: "Sindh",
      pincode: "74000",
      isDefault: true,
    },
  });

  console.log("📍 Addresses created");

  // ─── Platform config, coupons, packages ────────────────────────────────────
  await prisma.platformSetting.createMany({
    data: [
      {
        key: "commission.vendor_rate",
        value: "0.10",
        description: "Platform commission on vendor orders (10%)",
        updatedBy: admin.id,
      },
      {
        key: "commission.gardener_rate",
        value: "0.10",
        description: "Platform commission on gardener earnings (10%)",
        updatedBy: admin.id,
      },
      {
        key: "notifications.push_enabled",
        value: "true",
        description: "Global push notifications toggle",
        updatedBy: admin.id,
      },
    ],
  });

  await prisma.freelanceMatchConfig.create({
    data: {
      id: "singleton",
      autoMatchEnabled: true,
      autoMatchScoreThreshold: money(0.8),
      gardenerAcceptWindowMinutes: 30,
    },
  });

  const couponRent = await prisma.coupon.create({
    data: {
      code: "RENT10",
      description: "10% off plant rentals",
      discountType: DiscountType.PERCENTAGE,
      discountValue: money(10),
      minOrderAmount: money(1000),
      maxDiscountAmount: money(2000),
      applicableFor: ApplicableFor.RENT,
      usageLimit: 100,
      perUserLimit: 2,
      validFrom: daysAgo(30),
      validUntil: daysFromNow(90),
      isActive: true,
    },
  });

  const couponFlat = await prisma.coupon.create({
    data: {
      code: "WELCOME500",
      description: "PKR 500 off first order",
      discountType: DiscountType.FLAT,
      discountValue: money(500),
      minOrderAmount: money(2000),
      applicableFor: ApplicableFor.ALL,
      usageLimit: 500,
      perUserLimit: 1,
      validFrom: daysAgo(60),
      validUntil: daysFromNow(180),
      isActive: true,
    },
  });

  const starterPackage = await prisma.plantPackage.create({
    data: {
      name: "Office Starter Pack",
      slug: "office-starter-pack",
      description: "Snake plant + pothos for small offices",
      imageUrl: IMG.plant("photo-1599598425947-5202edd56bdb"),
      price: money(3500),
      originalPrice: money(4200),
      isCustomizable: false,
      isActive: true,
      isDefault: true,
      items: {
        create: [
          { plantId: snakePlant.id, quantity: 1, isRequired: true },
          { plantId: pothos.id, quantity: 2, isRequired: false },
        ],
      },
    },
  });

  await prisma.vendorPackage.createMany({
    data: [
      {
        publicId: "vp-green-basic",
        nurseryId: nursery1.id,
        name: "Green Basic Rental",
        tier: "BASIC",
        description: "2 plants, 30-day rental, 1 maintenance visit",
        maxPlantCount: 2,
        rentalDurationDays: 30,
        includesMaintenance: true,
        maintenanceVisitsPerMonth: 1,
        basePrice: money(4500),
        depositAmount: money(2000),
        allowsInstallments: false,
        isActive: true,
      },
      {
        publicId: "vp-urban-premium",
        nurseryId: nursery2.id,
        name: "Urban Premium",
        tier: "PREMIUM",
        description: "5 plants, 90-day rental, weekly maintenance",
        maxPlantCount: 5,
        rentalDurationDays: 90,
        includesMaintenance: true,
        maintenanceVisitsPerMonth: 4,
        basePrice: money(25000),
        depositAmount: money(8000),
        allowsInstallments: true,
        installmentOptions: { months: [3, 6] },
        isActive: true,
      },
    ],
  });

  console.log("⚙️  Settings, coupons & packages created");

  // ─── Featured, wishlists, interactions ─────────────────────────────────────
  const featured = [
    { plantId: monstera.id, type: FeatureType.EDITOR_PICK, order: 1 },
    { plantId: birdOfParadise.id, type: FeatureType.EDITOR_PICK, order: 2 },
    { plantId: snakePlant.id, type: FeatureType.TRENDING, order: 1 },
    { plantId: pothos.id, type: FeatureType.TRENDING, order: 2 },
    { plantId: zzPlant.id, type: FeatureType.NEW_ARRIVAL, order: 1 },
  ];
  for (const fp of featured) {
    await prisma.featuredPlant.create({
      data: {
        plantId: fp.plantId,
        featureType: fp.type,
        displayOrder: fp.order,
        isActive: true,
        startDate: dateOnly(daysAgo(7)),
        endDate: dateOnly(daysFromNow(60)),
      },
    });
  }

  await prisma.wishlist.createMany({
    data: [
      { userId: customer1.id, plantId: monstera.id },
      { userId: customer1.id, plantId: birdOfParadise.id },
      { userId: customer2.id, plantId: fiddleLeaf.id },
    ],
  });

  await prisma.userPlantInteraction.createMany({
    data: [
      { userId: customer1.id, plantId: monstera.id, interactionType: InteractionType.VIEW },
      { userId: customer1.id, plantId: monstera.id, interactionType: InteractionType.WISHLIST },
      { userId: customer2.id, plantId: birdOfParadise.id, interactionType: InteractionType.CART_ADD },
    ],
  });

  await prisma.userRecommendationPreference.create({
    data: {
      userId: customer1.id,
      city: "Karachi",
      lightPref: "medium",
      waterPref: "low",
      petFriendly: false,
      space: "apartment",
      topN: 5,
    },
  });

  // ─── Cart ──────────────────────────────────────────────────────────────────
  const cart1 = await prisma.cart.create({ data: { userId: customer1.id } });
  await prisma.cartItem.create({
    data: {
      cartId: cart1.id,
      plantId: monstera.id,
      quantity: 1,
      orderType: OrderType.RENT,
      rentStartDate: dateOnly(daysFromNow(3)),
      rentEndDate: dateOnly(daysFromNow(33)),
    },
  });
  await prisma.cartPackageItem.create({
    data: { cartId: cart1.id, packageId: starterPackage.id, quantity: 1 },
  });

  console.log("🛒 Cart created");

  // ─── Orders & payments ─────────────────────────────────────────────────────
  const rentStart = dateOnly(daysAgo(30));
  const rentEnd = dateOnly(daysAgo(1));

  const completedOrder = await prisma.order.create({
    data: {
      orderNumber: "ORD-SEED-1001",
      userId: customer1.id,
      nurseryId: nursery1.id,
      deliveryAddressId: addrC1Home.id,
      orderType: OrderType.RENT,
      status: OrderStatus.COMPLETED,
      subtotal: money(2500),
      deliveryFee: money(200),
      taxAmount: money(270),
      discountAmount: money(250),
      depositAmount: money(1500),
      totalAmount: money(4720),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: "card",
      deliveredAt: daysAgo(28),
      items: {
        create: {
          plantId: monstera.id,
          quantity: 1,
          orderType: OrderType.RENT,
          unitPrice: money(2500),
          depositPerUnit: money(1500),
          totalPrice: money(2500),
          rentStartDate: rentStart,
          rentEndDate: rentEnd,
          rentalStatus: RentalStatus.RETURNED,
          actualReturnDate: rentEnd,
        },
      },
    },
    include: { items: true },
  });

  const paymentCompleted = await prisma.payment.create({
    data: {
      orderId: completedOrder.id,
      userId: customer1.id,
      amount: money(4720),
      paymentType: PaymentType.ORDER,
      paymentMethod: "card",
      paymentGateway: "stripe",
      gatewayTransactionId: "pi_seed_completed_001",
      gatewayOrderId: "ord_seed_1001",
      status: TransactionStatus.SUCCESS,
    },
  });

  await prisma.couponUsage.create({
    data: {
      couponId: couponRent.id,
      userId: customer1.id,
      orderId: completedOrder.id,
      discountApplied: money(250),
    },
  });

  await prisma.vendorEarning.create({
    data: {
      nurseryId: nursery1.id,
      orderId: completedOrder.id,
      orderAmount: money(4720),
      commissionRate: money(0.1),
      commissionAmount: money(472),
      netEarnings: money(4248),
      status: EarningStatus.PAID,
    },
  });

  const deliveredBuyOrder = await prisma.order.create({
    data: {
      orderNumber: "ORD-SEED-1002",
      userId: customer2.id,
      nurseryId: nursery2.id,
      deliveryAddressId: addrC2.id,
      orderType: OrderType.BUY,
      status: OrderStatus.DELIVERED,
      subtotal: money(2000),
      deliveryFee: money(150),
      taxAmount: money(215),
      discountAmount: money(0),
      depositAmount: money(0),
      totalAmount: money(2365),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: "upi",
      deliveredAt: daysAgo(3),
      items: {
        create: {
          plantId: zzPlant.id,
          quantity: 1,
          orderType: OrderType.BUY,
          unitPrice: money(2000),
          totalPrice: money(2000),
        },
      },
    },
  });

  await prisma.payment.create({
    data: {
      orderId: deliveredBuyOrder.id,
      userId: customer2.id,
      amount: money(2365),
      paymentType: PaymentType.ORDER,
      paymentMethod: "upi",
      paymentGateway: "razorpay",
      gatewayTransactionId: "pay_seed_1002",
      status: TransactionStatus.SUCCESS,
    },
  });

  const awaitingPaymentOrder = await prisma.order.create({
    data: {
      orderNumber: "ORD-SEED-1003",
      userId: corporate.id,
      nurseryId: nursery1.id,
      deliveryAddressId: addrCorp.id,
      orderType: OrderType.RENT,
      status: OrderStatus.AWAITING_PAYMENT,
      subtotal: money(8000),
      deliveryFee: money(500),
      taxAmount: money(850),
      discountAmount: money(500),
      depositAmount: money(4000),
      totalAmount: money(12850),
      paymentStatus: PaymentStatus.PENDING,
      items: {
        create: [
          {
            plantId: snakePlant.id,
            quantity: 4,
            orderType: OrderType.RENT,
            unitPrice: money(1200),
            depositPerUnit: money(800),
            totalPrice: money(4800),
            rentStartDate: dateOnly(daysFromNow(7)),
            rentEndDate: dateOnly(daysFromNow(97)),
            rentalStatus: RentalStatus.ACTIVE,
          },
          {
            plantId: pothos.id,
            quantity: 4,
            orderType: OrderType.RENT,
            unitPrice: money(800),
            depositPerUnit: money(400),
            totalPrice: money(3200),
            rentStartDate: dateOnly(daysFromNow(7)),
            rentEndDate: dateOnly(daysFromNow(97)),
            rentalStatus: RentalStatus.ACTIVE,
          },
        ],
      },
    },
  });

  await prisma.couponUsage.create({
    data: {
      couponId: couponFlat.id,
      userId: corporate.id,
      orderId: awaitingPaymentOrder.id,
      discountApplied: money(500),
    },
  });

  const activeRentalOrder = await prisma.order.create({
    data: {
      orderNumber: "ORD-SEED-1004",
      userId: customer1.id,
      nurseryId: nursery2.id,
      deliveryAddressId: addrC1Office.id,
      orderType: OrderType.RENT,
      status: OrderStatus.DELIVERED,
      subtotal: money(4000),
      deliveryFee: money(300),
      taxAmount: money(430),
      discountAmount: money(0),
      depositAmount: money(2500),
      totalAmount: money(7230),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: "card",
      deliveredAt: daysAgo(10),
      items: {
        create: {
          plantId: birdOfParadise.id,
          quantity: 1,
          orderType: OrderType.RENT,
          unitPrice: money(4000),
          depositPerUnit: money(2500),
          totalPrice: money(4000),
          rentStartDate: dateOnly(daysAgo(10)),
          rentEndDate: dateOnly(daysFromNow(80)),
          rentalStatus: RentalStatus.ACTIVE,
        },
      },
    },
    include: { items: true },
  });

  await prisma.payment.create({
    data: {
      orderId: activeRentalOrder.id,
      userId: customer1.id,
      amount: money(7230),
      paymentType: PaymentType.ORDER,
      paymentMethod: "card",
      paymentGateway: "stripe",
      gatewayTransactionId: "pi_seed_active_004",
      status: TransactionStatus.SUCCESS,
    },
  });

  await prisma.rentalExtension.create({
    data: {
      orderItemId: activeRentalOrder.items[0].id,
      originalEndDate: dateOnly(daysFromNow(80)),
      newEndDate: dateOnly(daysFromNow(110)),
      extensionPrice: money(900),
      paymentStatus: PaymentStatus.PENDING,
    },
  });

  /** Overdue rental for penalty / OVERDUE bucket curl tests */
  const overdueRentalOrder = await prisma.order.create({
    data: {
      orderNumber: "ORD-SEED-1005",
      userId: customer1.id,
      nurseryId: nursery2.id,
      deliveryAddressId: addrC1Home.id,
      orderType: OrderType.RENT,
      status: OrderStatus.DELIVERED,
      subtotal: money(3500),
      deliveryFee: money(200),
      taxAmount: money(370),
      discountAmount: money(0),
      depositAmount: money(2000),
      totalAmount: money(6070),
      paymentStatus: PaymentStatus.PAID,
      paymentMethod: "card",
      deliveredAt: daysAgo(45),
      items: {
        create: {
          plantId: snakePlant.id,
          quantity: 1,
          orderType: OrderType.RENT,
          unitPrice: money(3500),
          depositPerUnit: money(2000),
          totalPrice: money(3500),
          rentStartDate: dateOnly(daysAgo(40)),
          rentEndDate: dateOnly(daysAgo(5)),
          rentalStatus: RentalStatus.OVERDUE,
        },
      },
    },
    include: { items: true },
  });

  await prisma.orderPenalty.create({
    data: {
      orderId: overdueRentalOrder.id,
      overdueDays: 5,
      avgDailyRate: money(116.67),
      penaltyMultiplier: money(1),
      runningTotal: money(583.35),
      payStatus: "PENDING" as const,
    },
  });

  console.log("📦 Orders & payments created");

  // ─── Service booking & maintenance ─────────────────────────────────────────
  const booking = await prisma.serviceBooking.create({
    data: {
      bookingNumber: "BKG-SEED-2001",
      userId: customer2.id,
      gardenerId: gardenerFreelance.id,
      serviceAddressId: addrC2.id,
      serviceType: ServiceType.ONE_TIME,
      serviceDate: dateOnly(daysAgo(5)),
      serviceTime: "10:00",
      durationHours: money(2),
      status: BookingStatus.COMPLETED,
      hourlyRate: money(1500),
      totalAmount: money(3000),
      paymentStatus: PaymentStatus.PAID,
      completedAt: daysAgo(5),
      notes: "Repot fiddle leaf and treat for mealybugs",
    },
  });

  await prisma.payment.create({
    data: {
      bookingId: booking.id,
      userId: customer2.id,
      amount: money(3000),
      paymentType: PaymentType.SERVICE_BOOKING,
      paymentMethod: "card",
      paymentGateway: "stripe",
      gatewayTransactionId: "pi_seed_booking_2001",
      status: TransactionStatus.SUCCESS,
    },
  });

  await prisma.gardenerEarning.create({
    data: {
      gardenerId: gardenerFreelance.id,
      bookingId: booking.id,
      earningType: EarningType.FREELANCE_BOOKING,
      grossAmount: money(3000),
      commissionRate: money(0.1),
      commissionAmount: money(300),
      netEarnings: money(2700),
      status: EarningStatus.PROCESSED,
    },
  });

  const maintenanceTask = await prisma.maintenanceTask.create({
    data: {
      taskNumber: "TSK-SEED-3001",
      orderItemId: activeRentalOrder.items[0].id,
      nurseryId: nursery2.id,
      gardenerId: gardenerStaff.id,
      userId: customer1.id,
      taskType: TaskType.SCHEDULED_MAINTENANCE,
      scheduledDate: dateOnly(daysFromNow(7)),
      scheduledTime: "14:00",
      addressId: addrC1Office.id,
      status: TaskStatus.ASSIGNED,
      priority: TaskPriority.MEDIUM,
      description: "Monthly watering and leaf cleaning for Bird of Paradise",
    },
  });

  await prisma.taskImage.create({
    data: {
      taskId: maintenanceTask.id,
      imageUrl: IMG.plant("photo-1520412099551-62b6bafeb5bb"),
      imageType: TaskImageType.BEFORE,
      caption: "Condition before service",
      uploadedBy: gardenerUser1.id,
    },
  });

  console.log("📅 Bookings & tasks created");

  // ─── Freelance jobs ─────────────────────────────────────────────────────────
  const openJob = await prisma.freelanceJob.create({
    data: {
      publicId: "fj-seed-open-01",
      userId: customer1.id,
      deliveryAddressId: addrC1Home.id,
      careTypes: ["watering", "pruning"],
      preferredDate: dateOnly(daysFromNow(5)),
      timeFrom: "09:00",
      timeTo: "12:00",
      plantDetails: "3 indoor plants on balcony",
      budgetAmount: money(2500),
      status: FreelanceJobStatus.OPEN,
      city: "Karachi",
      pincode: "75600",
    },
  });

  const doneJob = await prisma.freelanceJob.create({
    data: {
      publicId: "fj-seed-done-01",
      userId: customer2.id,
      orderId: deliveredBuyOrder.id,
      deliveryAddressId: addrC2.id,
      careTypes: ["repotting"],
      preferredDate: dateOnly(daysAgo(7)),
      timeFrom: "11:00",
      timeTo: "13:00",
      status: FreelanceJobStatus.COMPLETED,
      acceptedGardenerId: gardenerFreelance.id,
      city: "Karachi",
      pincode: "75500",
      startedAt: daysAgo(7),
      completedAt: daysAgo(7),
      completionNotes: "Repotted snake plant into larger terracotta pot",
      reviewRating: 5,
      reviewComment: "Excellent work!",
      paidAt: daysAgo(6),
    },
  });

  await prisma.payment.create({
    data: {
      freelanceJobId: doneJob.id,
      userId: customer2.id,
      amount: money(2800),
      paymentType: PaymentType.FREELANCE_JOB,
      paymentMethod: "card",
      paymentGateway: "stripe",
      gatewayTransactionId: "pi_seed_fj_done",
      status: TransactionStatus.SUCCESS,
    },
  });

  await prisma.gardenerEarning.create({
    data: {
      gardenerId: gardenerFreelance.id,
      freelanceJobId: doneJob.id,
      earningType: EarningType.FREELANCE_MARKET_JOB,
      grossAmount: money(2800),
      commissionRate: money(0.1),
      commissionAmount: money(280),
      netEarnings: money(2520),
      status: EarningStatus.PAID,
    },
  });

  console.log("💼 Freelance jobs created");

  // ─── Payouts & bank details ────────────────────────────────────────────────
  const payoutVendor = await prisma.payout.create({
    data: {
      payoutNumber: "PAY-SEED-V001",
      recipientType: RecipientType.VENDOR,
      recipientId: nursery1.id,
      amount: money(4248),
      status: PayoutStatus.COMPLETED,
      paymentMethod: "bank_transfer",
      bankReference: "NEFT-SEED-001",
      processedAt: daysAgo(20),
    },
  });

  await prisma.vendorEarning.updateMany({
    where: { orderId: completedOrder.id },
    data: { payoutId: payoutVendor.id },
  });

  await prisma.bankDetail.createMany({
    data: [
      {
        userId: vendor1.id,
        accountHolderName: "Ali Hassan",
        accountNumber: "123456789012",
        bankName: "HBL",
        ifscCode: "HABBPKKA",
        accountType: AccountType.CURRENT,
        isVerified: true,
        isPrimary: true,
      },
      {
        userId: gardenerUser2.id,
        accountHolderName: "Nadia Freelance",
        accountNumber: "987654321098",
        bankName: "Meezan Bank",
        ifscCode: "MEZNPKKA",
        accountType: AccountType.SAVINGS,
        isVerified: true,
        isPrimary: true,
      },
    ],
  });

  console.log("💰 Payouts & bank details created");

  // ─── Reviews, disputes, AI, chat ───────────────────────────────────────────
  await prisma.review.createMany({
    data: [
      {
        userId: customer1.id,
        reviewableType: ReviewableType.PLANT,
        reviewableId: monstera.id,
        orderId: completedOrder.id,
        rating: 5,
        title: "Stunning monstera",
        comment: "Perfect condition on delivery.",
        isVerifiedPurchase: true,
      },
      {
        userId: customer2.id,
        reviewableType: ReviewableType.NURSERY,
        reviewableId: nursery2.id,
        rating: 5,
        title: "Amazing nursery",
        comment: "Rare plants and helpful staff.",
        isVerifiedPurchase: true,
      },
      {
        userId: customer1.id,
        reviewableType: ReviewableType.GARDENER,
        reviewableId: gardenerFreelance.id,
        bookingId: booking.id,
        rating: 5,
        title: "Professional gardener",
        comment: "On time and very knowledgeable.",
        isVerifiedPurchase: true,
      },
    ],
  });

  const dispute = await prisma.dispute.create({
    data: {
      disputeNumber: "DSP-SEED-001",
      raisedBy: customer1.id,
      orderId: activeRentalOrder.id,
      disputeType: DisputeType.QUALITY,
      subject: "Leaf damage on delivery",
      description: "Two lower leaves were torn during transport.",
      status: DisputeStatus.UNDER_REVIEW,
    },
  });

  await prisma.disputeMessage.create({
    data: {
      disputeId: dispute.id,
      senderId: customer1.id,
      message: "Photos attached — please advise on replacement or credit.",
      attachments: [IMG.plant("photo-1520412099551-62b6bafeb5bb")],
    },
  });

  await prisma.plantDiagnosis.create({
    data: {
      userId: customer1.id,
      plantId: pothos.id,
      imageUrl: IMG.plant("photo-1600411833196-7c1f6b1a8b90"),
      diagnosisResult: {
        disease: "Root rot (early)",
        confidence: 0.82,
        recommendations: ["Reduce watering", "Improve drainage"],
      },
      diseaseDetected: "Root rot",
      confidenceScore: money(0.82),
      careSuggestions: "Let soil dry completely before next water.",
      severity: DiagnosisSeverity.MILD,
    },
  });

  const chatSession = await prisma.chatSession.create({
    data: {
      userId: customer1.id,
      title: "Help choosing office plants",
      contextPlantIds: [snakePlant.id, pothos.id],
      messages: {
        create: [
          {
            role: ChatRole.USER,
            content: "Which plants work best in a dim office?",
          },
          {
            role: ChatRole.ASSISTANT,
            content:
              "Snake plant and pothos are excellent low-light choices. Both are in our Office Starter Pack.",
          },
        ],
      },
    },
  });

  await prisma.notification.createMany({
    data: [
      {
        userId: customer1.id,
        title: "Order delivered",
        message: `Your rental ${activeRentalOrder.orderNumber} has been delivered.`,
        type: NotificationType.ORDER,
        referenceType: "order",
        referenceId: activeRentalOrder.id,
        isRead: true,
        readAt: daysAgo(10),
      },
      {
        userId: customer1.id,
        title: "Payment received",
        message: `Payment of PKR 4,720 confirmed for ${completedOrder.orderNumber}.`,
        type: NotificationType.PAYMENT,
        referenceType: "payment",
        referenceId: paymentCompleted.id,
      },
      {
        userId: vendor1.id,
        title: "New corporate order",
        message: `${awaitingPaymentOrder.orderNumber} is awaiting payment.`,
        type: NotificationType.ORDER,
        referenceType: "order",
        referenceId: awaitingPaymentOrder.id,
      },
      {
        userId: gardenerUser2.id,
        title: "New freelance job",
        message: "A customer posted a job in Clifton (75600).",
        type: NotificationType.TASK,
        referenceType: "freelance_job",
        referenceId: openJob.id,
      },
    ],
  });

  await prisma.deviceToken.create({
    data: {
      userId: customer1.id,
      token: "seed-fcm-token-customer1-web",
      platform: DevicePlatform.WEB,
    },
  });

  console.log(`
✅ Seed complete!

📧 All accounts use password: ${PASSWORD}

  Role       | Email
  -----------|---------------------------
  Admin      | admin@plantrent.com
  Vendor 1   | vendor1@plantrent.com     → Green Paradise Nursery
  Vendor 2   | vendor2@plantrent.com     → Urban Jungle PK
  Customer   | customer1@example.com
  Customer   | customer2@example.com
  Corporate  | corporate@acme.pk
  Gardener   | gardener1@plantrent.com   → nursery staff
  Freelancer | freelancer@plantrent.com

🎫 Coupons: RENT10 (10% rent), WELCOME500 (PKR 500 off)

📦 Sample orders: ORD-SEED-1001 (completed rent), 1002 (buy), 1003 (awaiting payment), 1004 (active rent), 1005 (overdue + penalty)
📅 Booking: BKG-SEED-2001 | Task: TSK-SEED-3001 | Jobs: fj-seed-open-01, fj-seed-done-01
💬 Chat session: ${chatSession.id}
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
