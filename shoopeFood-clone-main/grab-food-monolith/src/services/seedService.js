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

const { setUserRole } = require("../utils/roleAssignment");

const DEFAULT_ROLE_NAMES = ["CUSTOMER", "DRIVER", "MERCHANT", "ADMIN"];

const ensureDefaultRolesAndAssignments = async () => {
  const roles = await Promise.all(
    DEFAULT_ROLE_NAMES.map((name) => Role.findOrCreate({ where: { name }, defaults: { name } }))
  );

  const [users, drivers, restaurants, existingUserRoles] = await Promise.all([
    User.findAll({ attributes: ["id"], order: [["id", "ASC"]] }),
    DriverDetail.findAll({ attributes: ["userId"] }),
    Restaurant.findAll({ attributes: ["ownerId"] }),
    UserRole.findAll(),
  ]);

  const roleIdsByUserId = new Map();

  existingUserRoles.forEach((item) => {
    const values = roleIdsByUserId.get(item.userId) || new Set();
    values.add(item.roleId);
    roleIdsByUserId.set(item.userId, values);
  });

  const usersWithoutRole = users.filter((user) => !roleIdsByUserId.has(user.id));
  const driverUserIds = [...new Set(drivers.map((driver) => driver.userId).filter(Boolean))];
  const merchantOwnerIds = [...new Set(restaurants.map((restaurant) => restaurant.ownerId).filter(Boolean))];

  await Promise.all(usersWithoutRole.map((user) => setUserRole(user.id, "CUSTOMER")));
  await Promise.all(driverUserIds.map((userId) => setUserRole(userId, "DRIVER")));
  await Promise.all(merchantOwnerIds.map((ownerId) => setUserRole(ownerId, "MERCHANT")));

  const adminUser = users.find((item) => Number(item.id) === 5) || users[users.length - 1];
  if (adminUser) {
    await setUserRole(adminUser.id, "ADMIN");
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

  // 1. Create Users
  const users = await User.bulkCreate([
    // Customers (0, 1, 2, 3, 4)
    { fullName: "Nguyễn Văn Hùng", phone: "0901234567", password: "123" },
    { fullName: "Trần Thị Mai", phone: "0902345678", password: "123" },
    { fullName: "Lê Hoàng Phúc", phone: "0903456789", password: "123" },
    { fullName: "Phạm Thu Thảo", phone: "0904567890", password: "123" },
    { fullName: "Đặng Quang Huy", phone: "0905678901", password: "123" },
    // Merchants (5, 6, 7)
    { fullName: "Chủ Phở Lệ", phone: "0911111111", password: "123" },
    { fullName: "Chủ Cơm Tấm Ba Ghiền", phone: "0922222222", password: "123" },
    { fullName: "Quản lý Highlands Coffee", phone: "0933333333", password: "123" },
    // Drivers (8, 9, 10)
    { fullName: "Tài Xế Bùi Tuấn", phone: "0981111111", password: "123" },
    { fullName: "Tài Xế Ngô Vinh", phone: "0982222222", password: "123" },
    { fullName: "Tài Xế Vũ Khang", phone: "0983333333", password: "123" },
    // Admin (11)
    { fullName: "Admin System", phone: "0999999999", password: "123" },
  ]);

  // 2. Create Restaurants
  const restaurants = await Restaurant.bulkCreate([
    {
      ownerId: users[5].id,
      name: "Phở Lệ - Nguyễn Trãi",
      address: "413-415 Nguyễn Trãi, P. 7, Quận 5, TP. HCM",
      latitude: 10.7554,
      longitude: 106.6669,
      approvalStatus: "APPROVED",
      isOpen: true,
    },
    {
      ownerId: users[6].id,
      name: "Cơm Tấm Ba Ghiền",
      address: "84 Đặng Văn Ngữ, P. 10, Phú Nhuận, TP. HCM",
      latitude: 10.7936,
      longitude: 106.6749,
      approvalStatus: "APPROVED",
      isOpen: true,
    },
    {
      ownerId: users[7].id,
      name: "Highlands Coffee - Dinh Độc Lập",
      address: "135 Nam Kỳ Khởi Nghĩa, Bến Thành, Quận 1, TP. HCM",
      latitude: 10.7769,
      longitude: 106.6955,
      approvalStatus: "APPROVED",
      isOpen: true,
    },
  ]);

  // 3. Create Drivers Detail
  await DriverDetail.bulkCreate([
    {
      userId: users[8].id,
      vehicleType: "Honda AirBlade",
      licensePlate: "59F1-123.45",
      idCardNumber: "079090123456",
      approvalStatus: "APPROVED",
      isOnline: true,
    },
    {
      userId: users[9].id,
      vehicleType: "Yamaha Sirius",
      licensePlate: "59G1-678.90",
      idCardNumber: "079090234567",
      approvalStatus: "APPROVED",
      isOnline: true,
    },
    {
      userId: users[10].id,
      vehicleType: "Honda Wave Alpha",
      licensePlate: "59K1-456.78",
      idCardNumber: "079090345678",
      approvalStatus: "APPROVED",
      isOnline: true,
    },
  ]);

  // 4. Create Categories
  const categories = await Category.bulkCreate([
    // Phở Lệ Categories
    { restaurantId: restaurants[0].id, name: "Các món Phở" },
    { restaurantId: restaurants[0].id, name: "Thức uống" },
    // Ba Ghien Categories
    { restaurantId: restaurants[1].id, name: "Cơm Tấm" },
    { restaurantId: restaurants[1].id, name: "Món thêm" },
    // Highlands Categories
    { restaurantId: restaurants[2].id, name: "Cà phê" },
    { restaurantId: restaurants[2].id, name: "Trà" },
    { restaurantId: restaurants[2].id, name: "Bánh mì" },
  ]);

  // 5. Create Foods
  const foods = await Food.bulkCreate([
    // Phở Lệ (Cat 0, 1)
    { name: "Phở Tái Nạm", price: 75000, categoryId: categories[0].id, defaultQuantity: 100, currentQuantity: 100, quantityResetDate: stockDate, isAvailable: true },
    { name: "Phở Đặc Biệt", price: 85000, categoryId: categories[0].id, defaultQuantity: 100, currentQuantity: 100, quantityResetDate: stockDate, isAvailable: true },
    { name: "Trà Đá", price: 5000, categoryId: categories[1].id, defaultQuantity: 500, currentQuantity: 500, quantityResetDate: stockDate, isAvailable: true },
    { name: "Nước Mía", price: 15000, categoryId: categories[1].id, defaultQuantity: 100, currentQuantity: 100, quantityResetDate: stockDate, isAvailable: true },
    // Cơm Tấm Ba Ghiền (Cat 2, 3)
    { name: "Cơm Sườn Bì Chả", price: 90000, categoryId: categories[2].id, defaultQuantity: 200, currentQuantity: 200, quantityResetDate: stockDate, isAvailable: true },
    { name: "Cơm Sườn Lạp Xưởng", price: 95000, categoryId: categories[2].id, defaultQuantity: 150, currentQuantity: 150, quantityResetDate: stockDate, isAvailable: true },
    { name: "Canh Khổ Qua", price: 20000, categoryId: categories[3].id, defaultQuantity: 50, currentQuantity: 50, quantityResetDate: stockDate, isAvailable: true },
    { name: "Trứng Ốp La", price: 10000, categoryId: categories[3].id, defaultQuantity: 200, currentQuantity: 200, quantityResetDate: stockDate, isAvailable: true },
    // Highlands Coffee (Cat 4, 5, 6)
    { name: "Phin Sữa Đá", price: 35000, categoryId: categories[4].id, defaultQuantity: 300, currentQuantity: 300, quantityResetDate: stockDate, isAvailable: true },
    { name: "Cà phê đen đá", price: 29000, categoryId: categories[4].id, defaultQuantity: 200, currentQuantity: 200, quantityResetDate: stockDate, isAvailable: true },
    { name: "Trà Sen Vàng", price: 45000, categoryId: categories[5].id, defaultQuantity: 150, currentQuantity: 150, quantityResetDate: stockDate, isAvailable: true },
    { name: "Trà Thanh Đào", price: 45000, categoryId: categories[5].id, defaultQuantity: 150, currentQuantity: 150, quantityResetDate: stockDate, isAvailable: true },
    { name: "Bánh Mì Thịt Nướng", price: 29000, categoryId: categories[6].id, defaultQuantity: 100, currentQuantity: 100, quantityResetDate: stockDate, isAvailable: true },
  ]);

  // 6. Create OrderStatus
  const orderStatuses = await OrderStatus.bulkCreate([
    { code: "PENDING", label: "Chờ xác nhận", sortOrder: 1 },
    { code: "DRIVER_ACCEPTED", label: "Tài xế đã nhận", sortOrder: 2 },
    { code: "DRIVER_REJECTED", label: "Tài xế từ chối", sortOrder: 3 },
    { code: "CONFIRMED", label: "Đã xác nhận", sortOrder: 4 },
    { code: "PICKING_UP", label: "Đang lấy hàng", sortOrder: 5 },
    { code: "DELIVERING", label: "Đang giao hàng", sortOrder: 6 },
    { code: "COMPLETED", label: "Hoàn thành", sortOrder: 7 },
    { code: "CANCELLED", label: "Đã huỷ", sortOrder: 8 },
    { code: "TIMEOUT", label: "Quá thời gian", sortOrder: 9 },
  ]);

  // 7. Create Orders
  const orders = await Order.bulkCreate([
    // Order 1: PENDING (Customer 0 orders Pho Le)
    {
      orderCode: `ORD-SEED-${Date.now()}-1`,
      idempotencyKey: `IDEM-SEED-${Date.now()}-1`,
      distanceKm: 2.5,
      subtotalAmount: 160000, // 2 Tái Nạm, 2 Trà Đá
      totalAmount: 175000,
      shippingFee: 15000,
      statusId: orderStatuses[0].id, // PENDING
      customerId: users[0].id,
      driverId: null,
      restaurantId: restaurants[0].id,
      receiverAddress: "Ký Túc Xá Đại Học Bách Khoa, Quận 10",
      receiverLat: 10.7629,
      receiverLng: 106.6601,
      statusChangedAt: new Date(),
    },
    // Order 2: DELIVERING (Customer 1 orders Ba Ghien, Driver 8 accepts)
    {
      orderCode: `ORD-SEED-${Date.now()}-2`,
      idempotencyKey: `IDEM-SEED-${Date.now()}-2`,
      distanceKm: 4.2,
      subtotalAmount: 110000, // 1 Sườn Bì Chả, 1 Canh Khổ Qua
      totalAmount: 130000,
      shippingFee: 20000,
      statusId: orderStatuses[5].id, // DELIVERING
      customerId: users[1].id,
      driverId: users[8].id,
      restaurantId: restaurants[1].id,
      receiverAddress: "Vincom Center Landmark 81, Bình Thạnh",
      receiverLat: 10.795,
      receiverLng: 106.7218,
      statusChangedAt: new Date(),
    },
    // Order 3: COMPLETED (Customer 2 orders Highlands, Driver 9 completed)
    {
      orderCode: `ORD-SEED-${Date.now()}-3`,
      idempotencyKey: `IDEM-SEED-${Date.now()}-3`,
      distanceKm: 1.5,
      subtotalAmount: 109000, // 1 Phin Sữa Đá, 1 Trà Sen Vàng, 1 Bánh Mì
      totalAmount: 124000,
      shippingFee: 15000,
      statusId: orderStatuses[6].id, // COMPLETED
      customerId: users[2].id,
      driverId: users[9].id,
      restaurantId: restaurants[2].id,
      receiverAddress: "Phố Đi Bộ Nguyễn Huệ, Quận 1",
      receiverLat: 10.7744,
      receiverLng: 106.7032,
      statusChangedAt: new Date(),
    },
  ]);

  // 8. Create Order Items
  await OrderItem.bulkCreate([
    // Order 1 items
    { orderId: orders[0].id, foodId: foods[0].id, foodName: foods[0].name, quantity: 2, priceAtOrder: 75000 },
    { orderId: orders[0].id, foodId: foods[2].id, foodName: foods[2].name, quantity: 2, priceAtOrder: 5000 },
    // Order 2 items
    { orderId: orders[1].id, foodId: foods[4].id, foodName: foods[4].name, quantity: 1, priceAtOrder: 90000 },
    { orderId: orders[1].id, foodId: foods[6].id, foodName: foods[6].name, quantity: 1, priceAtOrder: 20000 },
    // Order 3 items
    { orderId: orders[2].id, foodId: foods[8].id, foodName: foods[8].name, quantity: 1, priceAtOrder: 35000 },
    { orderId: orders[2].id, foodId: foods[10].id, foodName: foods[10].name, quantity: 1, priceAtOrder: 45000 },
    { orderId: orders[2].id, foodId: foods[12].id, foodName: foods[12].name, quantity: 1, priceAtOrder: 29000 },
  ]);

  // 9. Create Driver Locations
  await DriverLocation.bulkCreate([
    // Driver 8: Delivering order 2 (near Landmark 81)
    {
      driverId: users[8].id,
      orderId: orders[1].id,
      latitude: 10.794,
      longitude: 106.721,
      heading: 90,
      speedKmh: 40,
    },
    // Driver 9: Free driver, wandering in District 1
    {
      driverId: users[9].id,
      orderId: null,
      latitude: 10.776,
      longitude: 106.7,
      heading: 45,
      speedKmh: 30,
    },
    // Driver 10: Free driver, waiting near Phu Nhuan
    {
      driverId: users[10].id,
      orderId: null,
      latitude: 10.793,
      longitude: 106.674,
      heading: 0,
      speedKmh: 0,
    },
  ]);

  await ensureDefaultRolesAndAssignments();
};
