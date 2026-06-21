const getBaseFeeFromOrder = (order) => {
  if (order.subtotalAmount !== undefined && order.subtotalAmount !== null) {
    return Number(order.subtotalAmount || 0);
  }
  return Math.max(0, Number(order.totalAmount || 0) - Number(order.shippingFee || 0));
};

const normalizeOrderItem = (item) => ({
  id: item.id,
  orderId: item.orderId,
  foodId: item.foodId,
  foodName: item.foodName || (item.food ? item.food.name : null),
  imageUrl: item.food ? item.food.imageUrl : null,
  quantity: Number(item.quantity || 0),
  priceAtOrder: Number(item.priceAtOrder || 0),
  lineTotal: Number(item.quantity || 0) * (
    Number(item.priceAtOrder || 0) + 
    (item.toppings ? item.toppings.reduce((sum, t) => sum + Number(t.priceAtOrder || 0) * Number(t.quantity || 1), 0) : 0)
  ),
  toppings: item.toppings ? item.toppings.map(t => ({
    id: t.id,
    toppingId: t.toppingId,
    toppingName: t.toppingName,
    priceAtOrder: Number(t.priceAtOrder || 0),
    quantity: Number(t.quantity || 1),
  })) : [],
});

const normalizeRestaurantSummary = (item) => {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    name: item.name || "",
    address: item.address || "",
    latitude: Number(item.latitude || 0),
    longitude: Number(item.longitude || 0),
    isOpen: Boolean(item.isOpen),
  };
};

const resolveCustomerName = (item) =>
  item.customerUser ? item.customerUser.fullName || `User ${item.customerId}` : `User ${item.customerId}`;

const resolveDriverSummary = (item) => {
  if (!item.driverId) {
    return null;
  }

  const user = item.driverUser;
  if (!user) {
    return {
      id: item.driverId,
      fullName: `Tai xe #${item.driverId}`,
      phone: "",
      vehicleType: "",
      licensePlate: "",
      isOnline: false,
    };
  }

  const detail = user.driverDetail;
  return {
    id: user.id,
    fullName: user.fullName || "",
    phone: user.phone || "",
    vehicleType: detail ? detail.vehicleType || "" : "",
    licensePlate: detail ? detail.licensePlate || "" : "",
    isOnline: detail ? Boolean(detail.isOnline) : false,
  };
};

const resolveCashToCollect = (item) => {
  const totalAmount = Number(item.totalAmount || 0);

  if (!item.payment) {
    return totalAmount;
  }

  if (item.payment.paymentMethod === "CASH" && item.payment.status !== "SUCCESS") {
    return totalAmount;
  }

  return 0;
};

const normalizeOrder = (item) => {
  const restaurant = item.Restaurant || item.restaurantInfo || item.restaurant || null;
  const customerName = resolveCustomerName(item);
  const customerPhone = item.customerUser ? item.customerUser.phone || "" : "";

  return {
    id: item.id,
    orderCode: item.orderCode,
    idempotencyKey: item.idempotencyKey,
    customer: customerName,
    customerName,
    customerPhone,
    customerId: item.customerId,
    restaurantId: item.restaurantId,
    restaurant: normalizeRestaurantSummary(restaurant),
    driverId: item.driverId,
    driver: resolveDriverSummary(item),
    voucherId: item.voucherId,
    receiverAddress: item.receiverAddress || "",
    receiverLat: item.receiverLat === null || item.receiverLat === undefined ? null : Number(item.receiverLat),
    receiverLng: item.receiverLng === null || item.receiverLng === undefined ? null : Number(item.receiverLng),
    distanceKm: Number(item.distanceKm || 0),
    baseFee: getBaseFeeFromOrder(item),
    subtotalAmount: Number(item.subtotalAmount || 0),
    taxAmount: Number(item.taxAmount || 0),
    discountAmount: Number(item.discountAmount || 0),
    shippingFee: Number(item.shippingFee || 0),
    totalAmount: Number(item.totalAmount || 0),
    cashToCollect: resolveCashToCollect(item),
    note: item.note || null,
    statusId: item.statusId,
    statusCode: item.statusInfo ? item.statusInfo.code : null,
    status: item.statusInfo ? item.statusInfo.code : null,
    statusLabel: item.statusInfo ? item.statusInfo.label : null,
    statusChangedAt: item.statusChangedAt,
    paymentMethod: item.payment ? item.payment.paymentMethod : null,
    paymentStatus: item.payment ? item.payment.status : null,
    items: item.items ? item.items.map(normalizeOrderItem) : [],
    version: item.version,
    cancelReason: item.cancelReason,
    cancelledByRole: item.cancelledByRole,
    cancelledByUserId: item.cancelledByUserId,
    cancelledAt: item.cancelledAt,
    createdAt: item.createdAt,
  };
};

module.exports = {
  getBaseFeeFromOrder,
  normalizeOrder,
  normalizeOrderItem,
  normalizeRestaurantSummary,
};
