const { User, Restaurant, Food, Order } = require("../models");

exports.seedIfEmpty = async () => {
  const [userCount, restaurantCount, foodCount, orderCount] = await Promise.all([
    User.count(),
    Restaurant.count(),
    Food.count(),
    Order.count(),
  ]);

  const hasAnyData = userCount > 0 || restaurantCount > 0 || foodCount > 0 || orderCount > 0;
  if (hasAnyData) {
    return;
  }

  const users = await User.bulkCreate([
    { fullName: "Long", phone: "0900000010", password: "123456" },
    { fullName: "An", phone: "0900000011", password: "123456" },
    { fullName: "Minh", phone: "0900000012", password: "123456" },
  ]);

  const restaurants = await Restaurant.bulkCreate([
    { ownerId: users[0].id, name: "Pho 24", address: "District 1", latitude: 10.77, longitude: 106.69 },
    { ownerId: users[0].id, name: "Com Tam 99", address: "District 3", latitude: 10.78, longitude: 106.68 },
  ]);

  await Food.bulkCreate([
    { name: "Com ga", price: 35000, categoryId: null },
    { name: "Bun bo", price: 40000, categoryId: null },
    { name: "Tra dao", price: 25000, categoryId: null },
  ]);

  await Order.bulkCreate([
    {
      orderCode: `ORD-SEED-${Date.now()}-1`,
      idempotencyKey: `IDEM-SEED-${Date.now()}-1`,
      distanceKm: 2,
      subtotalAmount: 10000,
      totalAmount: 17000,
      shippingFee: 7000,
      statusId: 1,
      customerId: users[1].id,
      restaurantId: restaurants[0].id,
      receiverAddress: "District 1",
      receiverLat: 10.77,
      receiverLng: 106.69,
    },
    {
      orderCode: `ORD-SEED-${Date.now()}-2`,
      idempotencyKey: `IDEM-SEED-${Date.now()}-2`,
      distanceKm: 3,
      subtotalAmount: 10000,
      totalAmount: 20500,
      shippingFee: 10500,
      statusId: 6,
      customerId: users[0].id,
      restaurantId: restaurants[1].id,
      receiverAddress: "District 3",
      receiverLat: 10.78,
      receiverLng: 106.68,
    },
  ]);
};
