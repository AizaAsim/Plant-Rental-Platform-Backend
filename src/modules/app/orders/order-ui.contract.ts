import { OrderStatus, PaymentStatus } from "@prisma/client";

export type CustomerOrderTab = "customer_order_pending" | "Payment" | "Delivered";

export function mapCustomerOrderTab(order: {
  status: OrderStatus;
  paymentStatus: PaymentStatus;
}): CustomerOrderTab | null {
  if (order.status === OrderStatus.PENDING) {
    return "customer_order_pending";
  }
  if (
    order.paymentStatus === PaymentStatus.PENDING &&
    (order.status === OrderStatus.CONFIRMED ||
      order.status === OrderStatus.AWAITING_PAYMENT ||
      order.status === OrderStatus.SLOT_CONFIRMED ||
      order.status === OrderStatus.SLOT_PROPOSED)
  ) {
    if (order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.AWAITING_PAYMENT) {
      return "Payment";
    }
    return "customer_order_pending";
  }
  if (
    order.status === OrderStatus.DELIVERED ||
    order.status === OrderStatus.OUT_FOR_DELIVERY ||
    (order.status === OrderStatus.PROCESSING && order.paymentStatus === PaymentStatus.PAID)
  ) {
    return "Delivered";
  }
  if (order.status === OrderStatus.CONFIRMED && order.paymentStatus === PaymentStatus.PENDING) {
    return "Payment";
  }
  return null;
}

export function cancellationDeadline(createdAt: Date, windowHours: number): Date {
  return new Date(createdAt.getTime() + windowHours * 3600 * 1000);
}

export function cancellationMeta(createdAt: Date, windowHours: number) {
  const deadline = cancellationDeadline(createdAt, windowHours);
  const remainingMs = Math.max(0, deadline.getTime() - Date.now());
  return {
    cancellation_deadline: deadline.toISOString(),
    cancellation_remaining_seconds: Math.floor(remainingMs / 1000),
    cancellation_window_hours: windowHours,
  };
}

export function enrichOrderForClient(
  order: {
    id: string;
    orderNumber: string;
    status: OrderStatus;
    paymentStatus: PaymentStatus;
    createdAt: Date;
    vendorApprovalSelections?: unknown;
  },
  windowHours: number
) {
  const tab = mapCustomerOrderTab(order);
  const cancel = cancellationMeta(order.createdAt, windowHours);
  const approved =
    order.status === OrderStatus.CONFIRMED ||
    order.status === OrderStatus.AWAITING_PAYMENT ||
    order.status === OrderStatus.SLOT_PROPOSED ||
    order.status === OrderStatus.SLOT_CONFIRMED ||
    order.vendorApprovalSelections != null;

  return {
    order_id: order.id,
    order_number: order.orderNumber,
    status: order.status,
    payment_status: order.paymentStatus,
    approval_status: approved
      ? order.status === OrderStatus.PENDING
        ? "PENDING"
        : "APPROVED"
      : "PENDING",
    customer_order_tab: tab,
    inventory_reserved: order.vendorApprovalSelections != null,
    can_cancel:
      order.status === OrderStatus.PENDING ||
      (order.status === OrderStatus.CONFIRMED && order.paymentStatus === PaymentStatus.PENDING) ||
      (order.status === OrderStatus.AWAITING_PAYMENT && cancel.cancellation_remaining_seconds > 0),
    ...cancel,
  };
}
