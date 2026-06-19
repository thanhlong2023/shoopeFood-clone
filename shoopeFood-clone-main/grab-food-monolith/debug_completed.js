/**
 * Debug script: check if completed orders exist and what the API would return
 * Run: node debug_completed.js <driverId>
 */
const { sequelize, Order, OrderStatus, DriverDetail, User, Review } = require('./src/models');
const { normalizeOrder } = require('./src/utils/orderNormalizer');
const orderRepository = require('./src/repositories/orderRepository');
const { Op } = require('sequelize');

async function debug(driverId) {
  try {
    await sequelize.authenticate();
    console.log('✅ DB connected\n');

    // 1. Check all drivers
    const drivers = await DriverDetail.findAll({
      include: [{ model: User, as: 'driverUser', attributes: ['id', 'fullName', 'phone'] }],
      limit: 10,
    });
    console.log('=== ALL DRIVERS ===');
    drivers.forEach(d => {
      console.log(`  Driver userId=${d.userId} | ${d.driverUser?.fullName} | status=${d.approvalStatus}`);
    });

    // 2. Check COMPLETED status
    const completedStatus = await OrderStatus.findOne({ where: { code: 'COMPLETED' } });
    console.log('\n=== COMPLETED STATUS ===');
    console.log(completedStatus ? `  id=${completedStatus.id} code=${completedStatus.code}` : '  ❌ NOT FOUND in DB!');

    if (!completedStatus) {
      console.log('\n❌ No COMPLETED status in order_statuses table!');
      const allStatuses = await OrderStatus.findAll();
      console.log('All statuses:', allStatuses.map(s => `${s.id}:${s.code}`).join(', '));
      process.exit(0);
    }

    // 3. Check ALL completed orders (no driver filter)
    const allCompleted = await Order.count({ where: { statusId: completedStatus.id } });
    console.log(`\n=== ALL COMPLETED ORDERS: ${allCompleted} ===`);

    // 4. Check for specific driver
    if (driverId) {
      const dId = Number(driverId);
      const count = await Order.count({ where: { driverId: dId, statusId: completedStatus.id } });
      console.log(`\n=== COMPLETED ORDERS FOR driverId=${dId}: ${count} ===`);

      // Sample a few completed orders
      const sample = await Order.findAll({
        where: { statusId: completedStatus.id },
        limit: 5,
        attributes: ['id', 'orderCode', 'driverId', 'customerId', 'statusId'],
      });
      console.log('\nSample completed orders (driverId field):');
      sample.forEach(o => {
        console.log(`  orderId=${o.id} orderCode=${o.orderCode} driverId=${o.driverId} customerId=${o.customerId}`);
      });
    } else {
      // Show all completed orders with driver
      const sample = await Order.findAll({
        where: { statusId: completedStatus.id },
        limit: 10,
        attributes: ['id', 'orderCode', 'driverId', 'customerId'],
      });
      console.log('\nAll completed orders:');
      sample.forEach(o => {
        console.log(`  orderId=${o.id} code=${o.orderCode} driverId=${o.driverId} customerId=${o.customerId}`);
      });
    }

    // 5. Check reviews
    const reviews = await Review.findAll({ where: { targetType: 'DRIVER' }, limit: 5 });
    console.log(`\n=== DRIVER REVIEWS: ${reviews.length} (sample) ===`);
    reviews.forEach(r => {
      console.log(`  reviewId=${r.id} orderId=${r.orderId} driverId(targetId)=${r.targetId} rating=${r.rating} comment="${r.comment}"`);
    });

  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    await sequelize.close();
  }
}

const driverId = process.argv[2];
debug(driverId);
