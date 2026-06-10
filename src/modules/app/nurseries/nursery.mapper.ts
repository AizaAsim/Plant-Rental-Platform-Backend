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
  profilePictureUrl?: string | null;
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

export function resolveThumbnailUrl(nursery: NurseryRow, orderedImages?: NurseryImageRow[]) {
  const gallery = orderedImages ?? nursery.images ?? [];
  const firstGallery = gallery.slice().sort((a, b) => a.displayOrder - b.displayOrder)[0];
  return firstGallery?.imageUrl ?? nursery.coverImageUrl ?? null;
}

export function toNurseryMediaResponse(nursery: NurseryRow) {
  const images = mapNurseryImages(nursery.images);
  return {
    coverImageUrl: nursery.coverImageUrl!,
    profilePictureUrl: nursery.profilePictureUrl!,
    logoUrl: nursery.logoUrl ?? null,
    images,
  };
}

export function toPublicNursery(nursery: NurseryRow, extra?: { distance?: number }) {
  const images = mapNurseryImages(nursery.images);
  return {
    id: nursery.id,
    name: nursery.name,
    ...(nursery.slug != null && { slug: nursery.slug }),
    description: nursery.description ?? null,
    coverImageUrl: nursery.coverImageUrl ?? null,
    profilePictureUrl: nursery.profilePictureUrl ?? null,
    thumbnailUrl: resolveThumbnailUrl(nursery, nursery.images),
    logoUrl: nursery.logoUrl ?? null,
    ratingAvg: String(nursery.ratingAvg ?? "0"),
    totalReviews: nursery.totalReviews ?? 0,
    images,
    ...(nursery.city != null && { city: nursery.city }),
    ...(nursery.isVerified != null && { isVerified: nursery.isVerified }),
    ...(extra?.distance != null && { distance: extra.distance }),
  };
}
