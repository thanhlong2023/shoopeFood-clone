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
    { name: "Long", email: "long@example.com", role: "admin" },
    { name: "An", email: "an@example.com", role: "customer" },
    { name: "Minh", email: "minh@example.com", role: "driver" },
  ]);

  const restaurants = await Restaurant.bulkCreate([
    { name: "Pho 24", address: "District 1", rating: 4.6 },
    { name: "Com Tam 99", address: "District 3", rating: 4.4 },
  ]);

  await Food.bulkCreate([
    { name: "Com ga", price: 35000, restaurantId: restaurants[0].id },
    { name: "Bun bo", price: 40000, restaurantId: restaurants[1].id },
    { name: "Tra dao", price: 25000, restaurantId: restaurants[0].id },
  ]);

  await Order.bulkCreate([
    {
      customer: "An",
      distanceKm: 2,
      baseFee: 10000,
      totalAmount: 17000,
      shippingFee: 17000,
      status: "PENDING",
      userId: users[1].id,
      restaurantId: restaurants[0].id,
    },
    {
      customer: "Long",
      distanceKm: 3,
      baseFee: 10000,
      totalAmount: 20500,
      shippingFee: 20500,
      status: "DELIVERING",
      userId: users[0].id,
      restaurantId: restaurants[1].id,
    },
  ]);
};
