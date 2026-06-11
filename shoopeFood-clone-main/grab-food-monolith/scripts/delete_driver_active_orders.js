require("dotenv").config();

const { Op } = require("sequelize");
const { User, Order, OrderStatus, DriverLocation, sequelize } = require("../src/models");

const DRIVER_PHONE = process.argv[2] || "0900000002";
const DRIVER_ACTIVE_STATUS_CODES = ["DRIVER_ACCEPTED", "CONFIRMED", "PICKING_UP", "DELIVERING"];

async function main() {
  const driver = await User.findOne({ where: { phone: DRIVER_PHONE } });
  if (!driver) {
    console.error(`Khong tim thay user voi SĐT ${DRIVER_PHONE}`);
    process.exit(1);
  }

  const statuses = await OrderStatus.findAll({
    where: { code: { [Op.in]: DRIVER_ACTIVE_STATUS_CODES } },
  });
  const statusIds = statuses.map((item) => item.id);

  const orders = await Order.findAll({
    where: {
      driverId: driver.id,
      statusId: { [Op.in]: statusIds },
    },
    include: [{ model: OrderStatus, as: "statusInfo" }],
    order: [["id", "ASC"]],
  });

  if (orders.length === 0) {
    console.log(`Khong co don dang giao nao cua tai xe ${DRIVER_PHONE} (userId=${driver.id})`);
    await sequelize.close();
    return;
  }

  console.log(`Tim thay ${orders.length} don dang giao cua ${DRIVER_PHONE} (userId=${driver.id}):`);

  for (const order of orders) {
    const statusCode = order.statusInfo ? order.statusInfo.code : order.statusId;
    console.log(`- #${order.id} ${order.orderCode} [${statusCode}]`);

    await DriverLocation.destroy({ where: { orderId: order.id } });
    await order.destroy();
  }

  console.log(`Da xoa ${orders.length} don.`);
  await sequelize.close();
}

main().catch(async (error) => {
  console.error(error);
  try {
    await sequelize.close();
  } catch (closeError) {
    // ignore
  }
  process.exit(1);
});
