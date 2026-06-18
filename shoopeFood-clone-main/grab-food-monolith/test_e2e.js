const { sequelize, User, Restaurant, DriverDetail, Food, Category, OrderStatus, DriverLocation, Order } = require('./src/models');
const orderController = require('./src/controllers/orderController');
const orderTimeoutService = require('./src/services/orderTimeoutService');
const { initializeDatabase } = require('./src/services/databaseInitializer');
const { Op } = require('sequelize');

async function createMockReqRes(user) {
    const req = { user, body: {}, params: {}, query: {} };
    const res = {
        status: function(s) { this.statusCode = s; return this; },
        json: function(data) { this.data = data; return this; },
        send: function(data) { this.data = data; return this; }
    };
    return { req, res };
}

async function runTests() {
    console.log('Starting E2E Tests...');
    try {
        await initializeDatabase();
        console.log('DB connected and initialized.');

        // 1. Setup Test Data
        let customerUser = await User.create({ email: 'test_cust@test.com', password: '123', fullName: 'Cust', phone: '0901000001' });
        let merchantUser = await User.create({ email: 'test_merch@test.com', password: '123', fullName: 'Merch', phone: '0902000002' });
        let driverUser = await User.create({ email: 'test_driver@test.com', password: '123', fullName: 'Driver', phone: '0903000003' });
        let adminUser = await User.create({ email: 'admin@test.com', password: '123', fullName: 'Admin', phone: '0904000004' });

        let restaurant = await Restaurant.create({ name: 'Test Rest', ownerId: merchantUser.id, approvalStatus: 'APPROVED', isOpen: true, latitude: 10, longitude: 10 });
        let driverDetail = await DriverDetail.create({ userId: driverUser.id, isOnline: true, approvalStatus: 'APPROVED', vehicleType: 'Motorbike', licensePlate: '59A1-12345' });
        let category = await Category.create({ name: 'Test Cat', restaurantId: restaurant.id });
        let food = await Food.create({ name: 'Test Food', price: 10000, categoryId: category.id, isAvailable: true, defaultQuantity: 100, currentQuantity: 100 });
        await DriverLocation.create({ driverId: driverUser.id, latitude: 10.01, longitude: 10.01 });

        // Helper to create order
        const createOrder = async () => {
            const { req, res } = await createMockReqRes({ id: customerUser.id, role: 'CUSTOMER' });
            req.body = {
                restaurantId: restaurant.id,
                receiverLat: 10.05, receiverLng: 10.05,
                distanceKm: 2, baseFee: 15000,
                items: [{ foodId: food.id, quantity: 1 }]
            };
            await orderController.createOrder(req, res);
            return res.data?.data;
        };

        // --- Test 1: Happy Path ---
        console.log('\n--- Test 1: Happy Path ---');
        let order1 = await createOrder();
        console.log('Created Order ID:', order1?.id, 'Status:', order1?.statusCode);
        
        let { req: r1, res: res1 } = await createMockReqRes({ id: merchantUser.id, role: 'MERCHANT' });
        r1.params = { id: order1.id }; r1.body = { statusCode: 'CONFIRMED' };
        await orderController.updateOrderStatus(r1, res1);
        console.log('Merchant Confirm:', res1.statusCode === undefined ? 'Success, Status: ' + res1.data?.data?.statusCode : res1.data?.message);

        let { req: r2, res: res2 } = await createMockReqRes({ id: driverUser.id, role: 'DRIVER' });
        r2.params = { id: order1.id };
        await orderController.acceptOrder(r2, res2);
        console.log('Driver Accept:', res2.statusCode === undefined ? 'Success, Status: ' + res2.data?.data?.statusCode : res2.data?.message);
        
        // --- Test 2: Race Condition ---
        console.log('\n--- Test 2: Race Condition ---');
        let order2 = await createOrder();
        let { req: r2_1, res: res2_1 } = await createMockReqRes({ id: merchantUser.id, role: 'MERCHANT' });
        r2_1.params = { id: order2.id }; r2_1.body = { statusCode: 'CONFIRMED' };
        let { req: r2_2, res: res2_2 } = await createMockReqRes({ id: merchantUser.id, role: 'MERCHANT' });
        r2_2.params = { id: order2.id }; r2_2.body = { statusCode: 'CONFIRMED' };
        
        console.log('Sending two concurrent update requests...');
        await Promise.all([
            orderController.updateOrderStatus(r2_1, res2_1),
            orderController.updateOrderStatus(r2_2, res2_2)
        ]);
        console.log('Req 1 Status:', res2_1.statusCode || 200, res2_1.data?.message || 'Success');
        console.log('Req 2 Status:', res2_2.statusCode || 200, res2_2.data?.message || 'Success');
        let checkOrder2 = await Order.findByPk(order2.id);
        console.log('Final version of Order 2:', checkOrder2.version);

        // --- Test 3: Same status no-op ---
        console.log('\n--- Test 3: Same-status no-op ---');
        let order3 = await createOrder();
        let { req: r3, res: res3 } = await createMockReqRes({ id: adminUser.id, role: 'ADMIN' });
        r3.params = { id: order3.id }; r3.body = { statusCode: 'PENDING' };
        await orderController.updateOrderStatus(r3, res3);
        console.log('No-op update version unchanged?', res3.data?.data?.version === order3.version);

        // --- Test 4: Driver Cancel Blocked ---
        console.log('\n--- Test 4: Driver Cancel Blocked ---');
        let { req: r4, res: res4 } = await createMockReqRes({ id: driverUser.id, role: 'DRIVER' });
        r4.params = { id: order1.id }; r4.body = { statusCode: 'CANCELLED' };
        await orderController.updateOrderStatus(r4, res4);
        console.log('Driver Cancel Attempt Status:', res4.statusCode, res4.data?.message);

        // --- Test 5: PENDING Timeout ---
        console.log('\n--- Test 5: PENDING Timeout ---');
        let order5 = await createOrder();
        await Order.update({ statusChangedAt: new Date(Date.now() - 20 * 60 * 1000) }, { where: { id: order5.id } });
        const count = await orderTimeoutService.cancelUnassignedPendingOrders();
        const check5 = await Order.findByPk(order5.id);
        console.log('Timeout Sweep canceled orders:', count);
        console.log('Order5 status:', (await OrderStatus.findByPk(check5.statusId)).code, '| Reason:', check5.cancelReason);

        // --- Test 6: CONFIRMED Timeout ---
        console.log('\n--- Test 6: CONFIRMED Timeout ---');
        let order6 = await createOrder();
        let { req: r6, res: res6 } = await createMockReqRes({ id: merchantUser.id, role: 'MERCHANT' });
        r6.params = { id: order6.id }; r6.body = { statusCode: 'CONFIRMED' };
        await orderController.updateOrderStatus(r6, res6);
        await Order.update({ statusChangedAt: new Date(Date.now() - 20 * 60 * 1000) }, { where: { id: order6.id } });
        const count2 = await orderTimeoutService.cancelUnassignedPendingOrders();
        const check6 = await Order.findByPk(order6.id);
        console.log('Timeout Sweep canceled orders:', count2);
        console.log('Order6 status:', (await OrderStatus.findByPk(check6.statusId)).code, '| Reason:', check6.cancelReason);

    } catch(err) {
        console.error(err);
    } finally {
        process.exit(0);
    }
}

runTests();
