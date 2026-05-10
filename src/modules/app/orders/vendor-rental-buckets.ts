export const VENDOR_RENTAL_BUCKETS = ["ONGOING", "DUE_TODAY", "OVERDUE", "COMPLETED"] as const;

export type VendorRentalBucket = (typeof VENDOR_RENTAL_BUCKETS)[number];
