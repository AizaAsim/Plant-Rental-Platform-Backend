import { Decimal } from "@prisma/client/runtime/library";

type NurseryImageRow = {
  id: string;
  imageUrl: string;
  displayOrder: number;
};

type NurseryRow = {
  id: string;
  name: string;
  slug?: string;
  description?: string | null;
  logoUrl?: string | null;
  coverImageUrl?: string | null;
  ratingAvg: Decimal | number | string;
  totalReviews: number;
  city?: string;
  isVerified?: boolean;
  images?: NurseryImageRow[];
};

export function mapNurseryImages(images: NurseryImageRow[] | undefined) {
  return (images ?? [])
    .slice()
    .sort((a, b) => a.displayOrder - b.displayOrder)
    .map((img) => ({
      id: img.id,
      imageUrl: img.imageUrl,
      displayOrder: img.displayOrder,
    }));
}

export function toPublicNursery(nursery: NurseryRow, extra?: { distance?: number }) {
  return {
    id: nursery.id,
    name: nursery.name,
    ...(nursery.slug != null && { slug: nursery.slug }),
    description: nursery.description ?? null,
    logoUrl: nursery.logoUrl ?? null,
    coverImageUrl: nursery.coverImageUrl ?? null,
    ratingAvg: String(nursery.ratingAvg ?? "0"),
    totalReviews: nursery.totalReviews ?? 0,
    images: mapNurseryImages(nursery.images),
    ...(nursery.city != null && { city: nursery.city }),
    ...(nursery.isVerified != null && { isVerified: nursery.isVerified }),
    ...(extra?.distance != null && { distance: extra.distance }),
  };
}
