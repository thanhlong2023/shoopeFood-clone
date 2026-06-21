const DEFAULT_ORDER_STATUS_CODE = "PENDING";

const toNullableNumber = (value) => {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  return Number.isFinite(Number(value)) ? Number(value) : null;
};

class OrderFactory {
  buildOrderCode() {
    const now = new Date();
    const datePart = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    return `ORD-${datePart}-${Date.now()}`;
  }

  buildIdempotencyKey() {
    return `IDEM-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  }

  buildCreatePayload(input) {
    return {
      orderCode: String(input.orderCode || this.buildOrderCode()).trim(),
      idempotencyKey: String(input.idempotencyKey || this.buildIdempotencyKey()).trim(),
      customerId: Number(input.customerId),
      restaurantId: Number(input.restaurantId),
      driverId: toNullableNumber(input.driverId),
      voucherId: toNullableNumber(input.voucherId),
      receiverAddress: String(input.receiverAddress || "").trim(),
      receiverLat: Number(input.receiverLat),
      receiverLng: Number(input.receiverLng),
      distanceKm: Number(input.distanceKm),
      subtotalAmount: Number(input.subtotalAmount),
      taxAmount: Number(input.taxAmount),
      totalAmount: Number(input.totalAmount),
      shippingFee: Number(input.shippingFee),
      discountAmount: Number(input.discountAmount),
      statusId: Number(input.statusId),
      statusChangedAt: input.statusChangedAt || new Date(),
      note: input.note ? String(input.note).trim() : null,
      version: 0,
    };
  }

  resolveStatusCode(inputStatusCode) {
    return String(inputStatusCode || "").trim().toUpperCase() || DEFAULT_ORDER_STATUS_CODE;
  }
}

module.exports = new OrderFactory();
module.exports.DEFAULT_ORDER_STATUS_CODE = DEFAULT_ORDER_STATUS_CODE;
