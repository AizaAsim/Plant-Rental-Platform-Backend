import { Decimal } from "@prisma/client/runtime/library";

export type RentalPricingBreakdown = {
  package_amount: number;
  add_on_total: number;
  delivery_fee: number;
  tax_amount: number;
  deposit_amount: number;
  total_amount: number;
};

/** Sum add-on line prices from booking body or stored bookingMeta.add_ons */
export function sumAddOnTotal(addOns: unknown): Decimal {
  if (!addOns || typeof addOns !== "object") return new Decimal(0);
  if (Array.isArray(addOns)) {
    let sum = new Decimal(0);
    for (const row of addOns) {
      if (row && typeof row === "object") {
        const price = Number((row as { price?: number }).price ?? 0);
        const qty = Number((row as { quantity?: number }).quantity ?? 1);
        if (Number.isFinite(price)) sum = sum.plus(price * (Number.isFinite(qty) ? qty : 1));
      }
    }
    return sum;
  }
  const obj = addOns as Record<string, unknown>;
  if (typeof obj.total === "number") return new Decimal(obj.total);
  if (typeof obj.amount === "number") return new Decimal(obj.amount);
  return new Decimal(0);
}

export function computeRentalOrderPricing(params: {
  packageBasePrice: Decimal | number;
  depositAmount: Decimal | number;
  addOns?: unknown;
  deliveryFee?: Decimal | number;
  taxRate?: number;
}): RentalPricingBreakdown {
  const packageAmount = new Decimal(params.packageBasePrice);
  const addOnTotal = sumAddOnTotal(params.addOns);
  const deliveryFee = new Decimal(params.deliveryFee ?? 50);
  const taxRate = params.taxRate ?? 0.05;
  const subtotalWithAddons = packageAmount.plus(addOnTotal);
  const taxAmount = subtotalWithAddons.plus(deliveryFee).times(taxRate);
  const totalAmount = subtotalWithAddons.plus(deliveryFee).plus(taxAmount);
  const depositAmount = new Decimal(params.depositAmount);

  return {
    package_amount: Number(packageAmount),
    add_on_total: Number(addOnTotal),
    delivery_fee: Number(deliveryFee),
    tax_amount: Number(taxAmount.toDecimalPlaces(2)),
    deposit_amount: Number(depositAmount),
    total_amount: Number(totalAmount.toDecimalPlaces(2)),
  };
}

export function pricingToOrderAmounts(pricing: RentalPricingBreakdown) {
  return {
    subtotal: new Decimal(pricing.package_amount).plus(pricing.add_on_total),
    deliveryFee: new Decimal(pricing.delivery_fee),
    taxAmount: new Decimal(pricing.tax_amount),
    totalAmount: new Decimal(pricing.total_amount),
    depositAmount: new Decimal(pricing.deposit_amount),
  };
}
