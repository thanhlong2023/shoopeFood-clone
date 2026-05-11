const {
  User,
  Role,
  UserRole,
  DriverDetail,
  DriverLocation,
  Restaurant,
  Category,
  Food,
  Order,
  OrderItem,
  OrderStatus,
} = require("../models");

const DEFAULT_ROLE_NAMES = ["CUSTOMER", "DRIVER", "MERCHANT", "ADMIN"];

const ensureDefaultRolesAndAssignments = async () => {
  const roles = await Promise.all(
    DEFAULT_ROLE_NAMES.map((name) => Role.findOrCreate({ where: { name }, defaults: { name } }))
  );

  const roleByName = new Map(roles.map(([role]) => [role.name, role]));
  const [users, drivers, restaurants, existingUserRoles] = await Promise.all([
    User.findAll({ attributes: ["id"], order: [["id", "ASC"]] }),
    DriverDetail.findAll({ attributes: ["userId"] }),
    Restaurant.findAll({ attributes: ["ownerId"] }),
    UserRole.findAll(),
  ]);

  const assignedRoleKeys = new Set(existingUserRoles.map((item) => `${item.userId}:${item.roleId}`));
  const roleIdsByUserId = new Map();

  existingUserRoles.forEach((item) => {
    const values = roleIdsByUserId.get(item.userId) || new Set();
    values.add(item.roleId);
    roleIdsByUserId.set(item.userId, values);
  });

  const ensureAssignment = async (userId, roleName) => {
    const role = roleByName.get(roleName);
    if (!role) {
      return;
    }

    const key = `${userId}:${role.id}`;
    if (assignedRoleKeys.has(key)) {
      return;
    }

    await UserRole.create({ userId, roleId: role.id });
    assignedRoleKeys.add(key);
  };

  await Promise.all(
    users
      .filter((user) => !roleIdsByUserId.has(user.id))
      .map((user) => ensureAssignment(user.id, "CUSTOMER"))
  );

  await Promise.all(drivers.map((driver) => ensureAssignment(driver.userId, "DRIVER")));
  await Promise.all(restaurants.map((restaurant) => ensureAssignment(restaurant.ownerId, "MERCHANT")));

  if (users[0]) {
    await ensureAssignment(users[0].id, "ADMIN");
  }
};

exports.seedIfEmpty = async () => {
  const [
    userCount,
    driverCount,
    driverLocationCount,
    restaurantCount,
    categoryCount,
    foodCount,
    orderCount,
    orderItemCount,
    orderStatusCount,
  ] = await Promise.all([
    User.count(),
    DriverDetail.count(),
    DriverLocation.count(),
    Restaurant.count(),
    Category.count(),
    Food.count(),
    Order.count(),
    OrderItem.count(),
    OrderStatus.count(),
  ]);

  const hasAnyData =
    userCount > 0 ||
    driverCount > 0 ||
    driverLocationCount > 0 ||
    restaurantCount > 0 ||
    categoryCount > 0 ||
    foodCount > 0 ||
    orderCount > 0 ||
    orderItemCount > 0 ||
    orderStatusCount > 0;

  if (hasAnyData) {
    await ensureDefaultRolesAndAssignments();
    return;
  }

  const stockDate = Food.getStockDate();

  const users = await User.bulkCreate([
    { fullName: "Long", phone: "0900000010", password: "123456" },
    { fullName: "An", phone: "0900000011", password: "123456" },
    { fullName: "Minh", phone: "0900000012", password: "123456" },
  ]);

  const restaurants = await Restaurant.bulkCreate([
    {
      ownerId: users[0].id,
      name: "Pho 24",
      address: "District 1",
      latitude: 10.77,
      longitude: 106.69,
      approvalStatus: "APPROVED",
      approvedBy: users[0].id,
      approvedAt: new Date(),
      isOpen: true,
      isOpenToday: true,
    },
    {
      ownerId: users[0].id,
      name: "Com Tam 99",
      address: "District 3",
      latitude: 10.78,
      longitude: 106.68,
      approvalStatus: "APPROVED",
      approvedBy: users[0].id,
      approvedAt: new Date(),
      isOpen: true,
      isOpenToday: true,
    },
  ]);

  await DriverDetail.bulkCreate([
    { userId: users[2].id, vehicleType: "Motorbike", licensePlate: "59A1-12345", isOnline: true },
  ]);

  const categories = await Category.bulkCreate([
    { restaurantId: restaurants[0].id, name: "Mon chinh" },
    { restaurantId: restaurants[0].id, name: "Nuoc uong" },
    { restaurantId: restaurants[1].id, name: "Diem tam" },
  ]);

  const foods = await Food.bulkCreate([
    {
      name: "Com ga",
      price: 35000,
      categoryId: categories[0].id,
      defaultQuantity: 40,
      currentQuantity: 40,
      quantityResetDate: stockDate,
    },
    {
      name: "Bun bo",
      price: 40000,
      categoryId: categories[0].id,
      defaultQuantity: 35,
      currentQuantity: 35,
      quantityResetDate: stockDate,
    },
    {
      name: "Tra dao",
      price: 25000,
      categoryId: categories[1].id,
      defaultQuantity: 80,
      currentQuantity: 80,
      quantityResetDate: stockDate,
    },
  ]);

  const orderStatuses = await OrderStatus.bulkCreate([
    { code: "PENDING", label: "Cho xac nhan", sortOrder: 1 },
    { code: "DRIVER_ACCEPTED", label: "Tai xe da nhan", sortOrder: 2 },
    { code: "DRIVER_REJECTED", label: "Tai xe tu choi", sortOrder: 3 },
    { code: "CONFIRMED", label: "Da xac nhan", sortOrder: 4 },
    { code: "PICKING_UP", label: "Dang lay hang", sortOrder: 5 },
    { code: "DELIVERING", label: "Dang giao hang", sortOrder: 6 },
    { code: "COMPLETED", label: "Hoan thanh", sortOrder: 7 },
    { code: "CANCELLED", label: "Da huy", sortOrder: 8 },
    { code: "TIMEOUT", label: "Qua thoi gian", sortOrder: 9 },
  ]);

  const orders = await Order.bulkCreate([
    {
      orderCode: `ORD-SEED-${Date.now()}-1`,
      idempotencyKey: `IDEM-SEED-${Date.now()}-1`,
      distanceKm: 2,
      subtotalAmount: 60000,
      totalAmount: 67000,
      shippingFee: 7000,
      statusId: orderStatuses[0].id,
      customerId: users[1].id,
      driverId: users[2].id,
      restaurantId: restaurants[0].id,
      receiverAddress: "12 Nguyen Hue, District 1",
      receiverLat: 10.7769,
      receiverLng: 106.7009,
    },
    {
      orderCode: `ORD-SEED-${Date.now()}-2`,
      idempotencyKey: `IDEM-SEED-${Date.now()}-2`,
      distanceKm: 3,
      subtotalAmount: 80000,
      totalAmount: 90500,
      shippingFee: 10500,
      statusId: orderStatuses[5].id,
      customerId: users[0].id,
      driverId: users[2].id,
      restaurantId: restaurants[1].id,
      receiverAddress: "280 Nam Ky Khoi Nghia, District 3",
      receiverLat: 10.784,
      receiverLng: 106.69,
    },
  ]);

  await OrderItem.bulkCreate([
    { orderId: orders[0].id, foodId: foods[0].id, quantity: 1, priceAtOrder: 35000 },
    { orderId: orders[0].id, foodId: foods[2].id, quantity: 1, priceAtOrder: 25000 },
    { orderId: orders[1].id, foodId: foods[1].id, quantity: 2, priceAtOrder: 40000 },
  ]);

  await DriverLocation.bulkCreate([
    {
      driverId: users[2].id,
      orderId: orders[0].id,
      latitude: restaurants[0].latitude,
      longitude: restaurants[0].longitude,
      heading: 90,
      speedKmh: 18,
    },
    {
      driverId: users[2].id,
      orderId: orders[1].id,
      latitude: restaurants[1].latitude,
      longitude: restaurants[1].longitude,
      heading: 110,
      speedKmh: 24,
    },
  ]);

  await ensureDefaultRolesAndAssignments();
};
