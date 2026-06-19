require("dotenv").config();

const {
  sequelize,
  User,
  Role,
  DriverDetail,
  DriverLocation,
  Restaurant,
  Category,
  Food,
  OrderStatus,
} = require("../src/models");
const { initializeDatabase } = require("../src/services/databaseInitializer");
const { setUserRole } = require("../src/utils/roleAssignment");
const { encodeGeohash } = require("../src/utils/geohash");

const PASSWORD = "123456";
const RESTAURANT_COUNT = 50;
const DRIVER_COUNT = 20;

const ORDER_STATUSES = [
  { code: "PENDING", label: "Cho xac nhan", sortOrder: 1 },
  { code: "DRIVER_ACCEPTED", label: "Tai xe da nhan", sortOrder: 2 },
  { code: "DRIVER_REJECTED", label: "Tai xe tu choi", sortOrder: 3 },
  { code: "CONFIRMED", label: "Da xac nhan", sortOrder: 4 },
  { code: "PICKING_UP", label: "Dang lay hang", sortOrder: 5 },
  { code: "DELIVERING", label: "Dang giao hang", sortOrder: 6 },
  { code: "COMPLETED", label: "Hoan thanh", sortOrder: 7 },
  { code: "CANCELLED", label: "Da huy", sortOrder: 8 },
  { code: "TIMEOUT", label: "Qua thoi gian", sortOrder: 9 },
];

const HCMC_LOCATIONS = [
  { area: "Ben Thanh", district: "Quan 1", lat: 10.7729, lng: 106.6984 },
  { area: "Nguyen Hue", district: "Quan 1", lat: 10.7756, lng: 106.7039 },
  { area: "Da Kao", district: "Quan 1", lat: 10.7902, lng: 106.698 },
  { area: "Bui Vien", district: "Quan 1", lat: 10.7673, lng: 106.693 },
  { area: "Thao Dien", district: "TP Thu Duc", lat: 10.8025, lng: 106.7316 },
  { area: "An Phu", district: "TP Thu Duc", lat: 10.8005, lng: 106.7472 },
  { area: "Binh An", district: "TP Thu Duc", lat: 10.7914, lng: 106.7209 },
  { area: "Landmark 81", district: "Binh Thanh", lat: 10.7953, lng: 106.7218 },
  { area: "Hang Xanh", district: "Binh Thanh", lat: 10.8019, lng: 106.7117 },
  { area: "Phu Nhuan", district: "Phu Nhuan", lat: 10.7992, lng: 106.6802 },
  { area: "Tan Dinh", district: "Quan 1", lat: 10.7928, lng: 106.6901 },
  { area: "Vo Van Tan", district: "Quan 3", lat: 10.7798, lng: 106.687 },
  { area: "Ban Co", district: "Quan 3", lat: 10.7756, lng: 106.6827 },
  { area: "Cho Lon", district: "Quan 5", lat: 10.7547, lng: 106.662 },
  { area: "Nguyen Trai", district: "Quan 5", lat: 10.756, lng: 106.667 },
  { area: "Su Van Hanh", district: "Quan 10", lat: 10.7712, lng: 106.6692 },
  { area: "Ly Thuong Kiet", district: "Quan 10", lat: 10.7735, lng: 106.6589 },
  { area: "Dam Sen", district: "Quan 11", lat: 10.768, lng: 106.6418 },
  { area: "Binh Tay", district: "Quan 6", lat: 10.7492, lng: 106.6516 },
  { area: "Phu My Hung", district: "Quan 7", lat: 10.7291, lng: 106.7217 },
  { area: "Tan Phong", district: "Quan 7", lat: 10.7387, lng: 106.707 },
  { area: "Vinh Khanh", district: "Quan 4", lat: 10.7617, lng: 106.7075 },
  { area: "Ta Quang Buu", district: "Quan 8", lat: 10.7366, lng: 106.675 },
  { area: "Bay Hien", district: "Tan Binh", lat: 10.7898, lng: 106.6536 },
  { area: "Tan Son Nhat", district: "Tan Binh", lat: 10.8136, lng: 106.6657 },
  { area: "Quang Trung", district: "Go Vap", lat: 10.833, lng: 106.6609 },
  { area: "Nguyen Van Qua", district: "Quan 12", lat: 10.8429, lng: 106.6317 },
  { area: "Aeon Binh Tan", district: "Binh Tan", lat: 10.7421, lng: 106.6128 },
  { area: "Hiep Binh", district: "TP Thu Duc", lat: 10.8272, lng: 106.7255 },
  { area: "Trung Son", district: "Binh Chanh", lat: 10.7394, lng: 106.6911 },
];

const RESTAURANT_CONCEPTS = [
  { brand: "Com Tam Hem", category: "Com tam", dishes: [["Com tam suon bi cha", 59000], ["Com tam suon cay", 62000]] },
  { brand: "Pho Bo Sai Gon", category: "Pho", dishes: [["Pho tai nam", 65000], ["Pho bo vien", 59000]] },
  { brand: "Bun Bo Co Do", category: "Bun bo", dishes: [["Bun bo dac biet", 70000], ["Bun gio heo", 68000]] },
  { brand: "Banh Mi Nong", category: "Banh mi", dishes: [["Banh mi thit nuong", 32000], ["Banh mi xiu mai", 35000]] },
  { brand: "Hu Tieu Nam Vang", category: "Hu tieu", dishes: [["Hu tieu nam vang", 62000], ["Mi hoanh thanh", 58000]] },
  { brand: "Bun Thit Nuong Xua", category: "Bun", dishes: [["Bun thit nuong cha gio", 55000], ["Goi cuon tom thit", 42000]] },
  { brand: "Mi Quang Pho Nho", category: "Mi quang", dishes: [["Mi quang ga", 60000], ["Cao lau heo", 62000]] },
  { brand: "Ga Gion Sai Gon", category: "Ga ran", dishes: [["Ga ran gion cay", 69000], ["Burger ga", 55000]] },
  { brand: "Lau Thai Nong", category: "Lau", dishes: [["Lau thai tom yum", 189000], ["Lau hai san", 219000]] },
  { brand: "Tra Sua Pho", category: "Do uong", dishes: [["Tra sua tran chau", 39000], ["Tra dao cam sa", 45000]] },
  { brand: "Ca Phe Sang", category: "Ca phe", dishes: [["Ca phe sua da", 29000], ["Bac xiu", 35000]] },
  { brand: "Oc Dem", category: "Oc", dishes: [["Oc huong xao bo toi", 99000], ["So diep nuong mo hanh", 89000]] },
  { brand: "Banh Xeo Mien Tay", category: "Banh xeo", dishes: [["Banh xeo tom thit", 78000], ["Banh khot", 65000]] },
  { brand: "Chao Long Nong", category: "Chao", dishes: [["Chao long", 45000], ["Doi truong chien", 75000]] },
  { brand: "Sushi Corner", category: "Nhat", dishes: [["Sushi ca hoi", 99000], ["Com cuon california", 89000]] },
  { brand: "Bep Han Quoc", category: "Han Quoc", dishes: [["Kimbap", 55000], ["Ga sot cay Han Quoc", 79000]] },
  { brand: "Com Chay An Nhien", category: "Mon chay", dishes: [["Com chay ngu sac", 52000], ["Bun Hue chay", 58000]] },
  { brand: "Com Ga Pho", category: "Com ga", dishes: [["Com ga xoi mo", 62000], ["Com bo luc lac", 78000]] },
  { brand: "Lau Nam Xanh", category: "Lau", dishes: [["Lau nam", 169000], ["Lau ga la e", 179000]] },
  { brand: "Hai San Nhanh", category: "Hai san", dishes: [["Tom rang me", 119000], ["Muc chien nuoc mam", 109000]] },
  { brand: "Che Sai Gon", category: "Trang mieng", dishes: [["Che Thai", 35000], ["Rau cau dua", 28000]] },
  { brand: "Bun Rieu Ngo", category: "Bun", dishes: [["Bun rieu cua", 52000], ["Banh canh cua", 68000]] },
  { brand: "Pizza Nha Lam", category: "Pizza", dishes: [["Pizza hai san", 149000], ["Pizza pepperoni", 139000]] },
  { brand: "Healthy Bowl", category: "Healthy", dishes: [["Salad uc ga", 69000], ["Goi ga xe phay", 59000]] },
  { brand: "Bep Thai", category: "Thai", dishes: [["Pad Thai", 79000], ["Tom yum goong", 89000]] },
];

const STREET_NAMES = [
  "Le Loi",
  "Nguyen Trai",
  "Vo Van Tan",
  "Dien Bien Phu",
  "Nguyen Thi Minh Khai",
  "Tran Hung Dao",
  "Phan Xich Long",
  "Hoang Sa",
  "Truong Sa",
  "Nguyen Van Linh",
];

const pad = (value, size = 2) => String(value).padStart(size, "0");

const makePhone = (prefix, index) => `${prefix}${pad(index, 4)}`;

const withOffset = (location, index) => {
  const cycle = Math.floor(index / HCMC_LOCATIONS.length);
  const latOffset = (((index % 5) - 2) * 0.0012) + cycle * 0.002;
  const lngOffset = ((((index * 2) % 5) - 2) * 0.0012) - cycle * 0.0015;

  return {
    latitude: Number((location.lat + latOffset).toFixed(6)),
    longitude: Number((location.lng + lngOffset).toFixed(6)),
  };
};

const getRestaurantSeeds = () =>
  Array.from({ length: RESTAURANT_COUNT }, (_, index) => {
    const location = HCMC_LOCATIONS[index % HCMC_LOCATIONS.length];
    const concept = RESTAURANT_CONCEPTS[index % RESTAURANT_CONCEPTS.length];
    const coordinates = withOffset(location, index);
    const street = STREET_NAMES[index % STREET_NAMES.length];
    const number = 12 + index * 3;

    return {
      ...concept,
      name: `HCMC Demo ${pad(index + 1)} - ${concept.brand} ${location.area}`,
      address: `${number} ${street}, ${location.area}, ${location.district}, TP. HCM`,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    };
  });

const DEMO_CUSTOMERS = [
  { fullName: "HCMC Demo Customer Quan 1", phone: "0709000001" },
  { fullName: "HCMC Demo Customer Quan 7", phone: "0709000002" },
  { fullName: "HCMC Demo Customer Thu Duc", phone: "0709000003" },
];

const ensureRoles = async (transaction) => {
  for (const name of ["CUSTOMER", "DRIVER", "MERCHANT", "ADMIN"]) {
    await Role.findOrCreate({ where: { name }, defaults: { name }, transaction });
  }
};

const ensureOrderStatuses = async (transaction) => {
  let created = 0;
  let updated = 0;

  for (const status of ORDER_STATUSES) {
    const [item, wasCreated] = await OrderStatus.findOrCreate({
      where: { code: status.code },
      defaults: status,
      transaction,
    });

    if (wasCreated) {
      created += 1;
      continue;
    }

    await item.update(
      {
        label: status.label,
        sortOrder: status.sortOrder,
      },
      { transaction }
    );
    updated += 1;
  }

  return { created, updated };
};

const ensureUser = async ({ fullName, phone, roleName, ratingAvg = 5 }, transaction) => {
  const [user, wasCreated] = await User.findOrCreate({
    where: { phone },
    defaults: {
      fullName,
      phone,
      password: PASSWORD,
      ratingAvg,
    },
    transaction,
  });

  if (!wasCreated) {
    await user.update({ fullName, ratingAvg }, { transaction });
  }

  await setUserRole(user.id, roleName, { transaction });

  return { user, wasCreated };
};

const ensureDrivers = async (transaction) => {
  const now = new Date();
  const result = {
    usersCreated: 0,
    driversCreated: 0,
    locationsCreated: 0,
    locationsUpdated: 0,
  };

  for (let index = 1; index <= DRIVER_COUNT; index += 1) {
    const location = HCMC_LOCATIONS[(index * 3) % HCMC_LOCATIONS.length];
    const coordinates = withOffset(location, index + 7);
    const phone = makePhone("07092", index);
    const { user, wasCreated: userWasCreated } = await ensureUser(
      {
        fullName: `HCMC Demo Driver ${pad(index)}`,
        phone,
        roleName: "DRIVER",
        ratingAvg: 4.7 + (index % 3) * 0.1,
      },
      transaction
    );

    if (userWasCreated) {
      result.usersCreated += 1;
    }

    const [driver, driverWasCreated] = await DriverDetail.findOrCreate({
      where: { userId: user.id },
      defaults: {
        userId: user.id,
        vehicleType: index % 2 === 0 ? "Honda Vision" : "Yamaha Sirius",
        licensePlate: `59D1-${pad(index, 3)}.${pad(10 + index)}`,
        idCardNumber: `079200${pad(index, 6)}`,
        approvalStatus: "APPROVED",
        isOnline: true,
      },
      transaction,
    });

    if (driverWasCreated) {
      result.driversCreated += 1;
    } else {
      await driver.update(
        {
          approvalStatus: "APPROVED",
          isOnline: true,
        },
        { transaction }
      );
    }

    const locationPayload = {
      driverId: user.id,
      orderId: null,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
      geohash: encodeGeohash(coordinates.latitude, coordinates.longitude),
      heading: (index * 17) % 360,
      speedKmh: 0,
      createdAt: now,
    };
    const existingLocation = await DriverLocation.findOne({
      where: {
        driverId: user.id,
        orderId: null,
      },
      order: [["created_at", "DESC"]],
      transaction,
    });

    if (existingLocation) {
      await existingLocation.update(locationPayload, { transaction });
      result.locationsUpdated += 1;
    } else {
      await DriverLocation.create(locationPayload, { transaction });
      result.locationsCreated += 1;
    }
  }

  return result;
};

const ensureRestaurantsAndFoods = async (merchantUsers, transaction) => {
  const stockDate = Food.getStockDate();
  const result = {
    restaurantsCreated: 0,
    restaurantsUpdated: 0,
    categoriesCreated: 0,
    foodsCreated: 0,
    foodsUpdated: 0,
  };

  const restaurantSeeds = getRestaurantSeeds();

  for (let index = 0; index < restaurantSeeds.length; index += 1) {
    const seed = restaurantSeeds[index];
    const owner = merchantUsers[index % merchantUsers.length];
    const [restaurant, restaurantWasCreated] = await Restaurant.findOrCreate({
      where: { name: seed.name },
      defaults: {
        ownerId: owner.id,
        name: seed.name,
        address: seed.address,
        latitude: seed.latitude,
        longitude: seed.longitude,
        openingTime: "07:00:00",
        closingTime: "22:00:00",
        isOpen: true,
        isOpenToday: true,
        ratingAvg: 4.3 + (index % 7) * 0.1,
        approvalStatus: "APPROVED",
        approvedBy: owner.id,
        approvedAt: new Date(),
        deletedAt: null,
      },
      transaction,
    });

    if (restaurantWasCreated) {
      result.restaurantsCreated += 1;
    } else {
      await restaurant.update(
        {
          ownerId: owner.id,
          address: seed.address,
          latitude: seed.latitude,
          longitude: seed.longitude,
          isOpen: true,
          isOpenToday: true,
          approvalStatus: "APPROVED",
          deletedAt: null,
        },
        { transaction }
      );
      result.restaurantsUpdated += 1;
    }

    const [category, categoryWasCreated] = await Category.findOrCreate({
      where: {
        restaurantId: restaurant.id,
        name: seed.category,
      },
      defaults: {
        restaurantId: restaurant.id,
        name: seed.category,
      },
      transaction,
    });

    if (categoryWasCreated) {
      result.categoriesCreated += 1;
    }

    for (let dishIndex = 0; dishIndex < seed.dishes.length; dishIndex += 1) {
      const [name, basePrice] = seed.dishes[dishIndex];
      const defaultQuantity = 80 + ((index + dishIndex) % 5) * 20;
      const [food, foodWasCreated] = await Food.findOrCreate({
        where: {
          categoryId: category.id,
          name,
        },
        defaults: {
          categoryId: category.id,
          name,
          price: basePrice,
          isAvailable: true,
          defaultQuantity,
          currentQuantity: defaultQuantity,
          quantityResetDate: stockDate,
        },
        transaction,
      });

      if (foodWasCreated) {
        result.foodsCreated += 1;
      } else {
        await food.update(
          {
            price: basePrice,
            isAvailable: true,
            defaultQuantity,
            currentQuantity: defaultQuantity,
            quantityResetDate: stockDate,
          },
          { transaction }
        );
        result.foodsUpdated += 1;
      }
    }
  }

  return result;
};

const seedHcmcDemoData = async () => {
  await initializeDatabase();

  const summary = await sequelize.transaction(async (transaction) => {
    await ensureRoles(transaction);
    const orderStatuses = await ensureOrderStatuses(transaction);

    const customerResults = [];
    for (const customer of DEMO_CUSTOMERS) {
      customerResults.push(await ensureUser({ ...customer, roleName: "CUSTOMER" }, transaction));
    }

    const merchantUsers = [];
    let merchantUsersCreated = 0;
    for (let index = 1; index <= 10; index += 1) {
      const { user, wasCreated } = await ensureUser(
        {
          fullName: `HCMC Demo Merchant ${pad(index)}`,
          phone: makePhone("07091", index),
          roleName: "MERCHANT",
        },
        transaction
      );
      merchantUsers.push(user);
      if (wasCreated) {
        merchantUsersCreated += 1;
      }
    }

    const drivers = await ensureDrivers(transaction);
    const catalog = await ensureRestaurantsAndFoods(merchantUsers, transaction);

    return {
      customersCreated: customerResults.filter((item) => item.wasCreated).length,
      merchantUsersCreated,
      driverUsersCreated: drivers.usersCreated,
      driversCreated: drivers.driversCreated,
      driverLocationsCreated: drivers.locationsCreated,
      driverLocationsUpdated: drivers.locationsUpdated,
      orderStatuses,
      ...catalog,
    };
  });

  return summary;
};

if (require.main === module) {
  seedHcmcDemoData()
    .then((summary) => {
      console.log("HCMC demo seed completed.");
      console.table(summary);
    })
    .catch((error) => {
      console.error("HCMC demo seed failed:", error);
      process.exitCode = 1;
    })
    .finally(async () => {
      await sequelize.close();
    });
}

module.exports = {
  seedHcmcDemoData,
};
