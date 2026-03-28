const { DriverDetail, User, sequelize } = require("../models");

const normalizeDriver = (item) => {
  const user = item.driverUser || item.User || null;

  return {
    id: item.userId,
    fullName: user ? user.fullName || "" : "",
    phone: user ? user.phone || "" : "",
    ratingAvg: Number(user ? user.ratingAvg || 0 : 0),
    vehicleType: item.vehicleType || "",
    licensePlate: item.licensePlate || "",
    isOnline: Boolean(item.isOnline),
    createdAt: user ? user.createdAt : null,
  };
};

const driverInclude = [{ model: User, as: "driverUser", attributes: ["id", "fullName", "phone", "ratingAvg", "createdAt"] }];

exports.getDrivers = async (req, res) => {
  try {
    const items = await DriverDetail.findAll({ include: driverInclude, order: [["userId", "ASC"]] });
    return res.json({ data: items.map(normalizeDriver) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getDriverById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude });

    if (!item) {
      return res.status(404).json({ message: "Driver not found" });
    }

    return res.json({ data: normalizeDriver(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getDriverInfo = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude });

    if (!item) {
      return res.status(404).json({ message: "Driver not found" });
    }

    const normalized = normalizeDriver(item);
    return res.json({
      data: {
        driverId: normalized.id,
        fullName: normalized.fullName,
        phone: normalized.phone,
        vehicleType: normalized.vehicleType,
        licensePlate: normalized.licensePlate,
        ratingAvg: normalized.ratingAvg,
        isOnline: normalized.isOnline,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createDriver = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const {
      fullName,
      phone,
      password = "123456",
      ratingAvg = 5.0,
      vehicleType = "",
      licensePlate = "",
      isOnline = false,
    } = req.body;

    if (!fullName || !phone) {
      await transaction.rollback();
      return res.status(400).json({ message: "fullName and phone are required" });
    }

    const normalizedPhone = String(phone).trim();
    const existedUser = await User.findOne({ where: { phone: normalizedPhone }, transaction });
    if (existedUser) {
      await transaction.rollback();
      return res.status(409).json({ message: "Phone already exists" });
    }

    const newUser = await User.create(
      {
        fullName: String(fullName).trim(),
        phone: normalizedPhone,
        password: String(password).trim() || "123456",
        ratingAvg: Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : 5.0,
      },
      { transaction }
    );

    const newDriver = await DriverDetail.create(
      {
        userId: newUser.id,
        vehicleType: String(vehicleType || "").trim(),
        licensePlate: String(licensePlate || "").trim(),
        isOnline: Boolean(isOnline),
      },
      { transaction }
    );

    await transaction.commit();

    const created = await DriverDetail.findOne({ where: { userId: newDriver.userId }, include: driverInclude });
    return res.status(201).json({ message: "Created", data: normalizeDriver(created || newDriver) });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ message: error.message });
  }
};

exports.updateDriver = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const id = Number(req.params.id);
    const { fullName, phone, password, ratingAvg, vehicleType, licensePlate, isOnline } = req.body;

    const item = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude, transaction, lock: true });
    if (!item || !item.driverUser) {
      await transaction.rollback();
      return res.status(404).json({ message: "Driver not found" });
    }

    const user = item.driverUser;

    if (phone !== undefined) {
      const normalizedPhone = String(phone).trim();
      if (!normalizedPhone) {
        await transaction.rollback();
        return res.status(400).json({ message: "phone cannot be empty" });
      }

      if (normalizedPhone !== user.phone) {
        const existedPhone = await User.findOne({ where: { phone: normalizedPhone }, transaction });
        if (existedPhone) {
          await transaction.rollback();
          return res.status(409).json({ message: "Phone already exists" });
        }
      }

      user.phone = normalizedPhone;
    }

    if (fullName !== undefined) {
      user.fullName = String(fullName).trim();
    }

    if (password !== undefined) {
      user.password = String(password).trim();
    }

    if (ratingAvg !== undefined) {
      if (!Number.isFinite(Number(ratingAvg))) {
        await transaction.rollback();
        return res.status(400).json({ message: "ratingAvg must be a number" });
      }
      user.ratingAvg = Number(ratingAvg);
    }

    if (vehicleType !== undefined) {
      item.vehicleType = String(vehicleType).trim();
    }

    if (licensePlate !== undefined) {
      item.licensePlate = String(licensePlate).trim();
    }

    if (isOnline !== undefined) {
      item.isOnline = Boolean(isOnline);
    }

    await Promise.all([user.save({ transaction }), item.save({ transaction })]);
    await transaction.commit();

    const updated = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude });
    return res.json({ message: "Updated", data: normalizeDriver(updated || item) });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteDriver = async (req, res) => {
  const transaction = await sequelize.transaction();

  try {
    const id = Number(req.params.id);
    const item = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude, transaction, lock: true });

    if (!item) {
      await transaction.rollback();
      return res.status(404).json({ message: "Driver not found" });
    }

    const user = await User.findByPk(id, { transaction, lock: true });
    if (user) {
      await user.destroy({ transaction });
    } else {
      await item.destroy({ transaction });
    }

    await transaction.commit();
    return res.json({ message: "Deleted", data: normalizeDriver(item) });
  } catch (error) {
    await transaction.rollback();
    return res.status(500).json({ message: error.message });
  }
};

exports.updateDriverOnlineStatus = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { isOnline } = req.body;

    if (typeof isOnline !== "boolean") {
      return res.status(400).json({ message: "isOnline must be boolean" });
    }

    const item = await DriverDetail.findOne({ where: { userId: id }, include: driverInclude });
    if (!item) {
      return res.status(404).json({ message: "Driver not found" });
    }

    await item.update({ isOnline });
    return res.json({ message: "Updated", data: normalizeDriver(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.setDriverOnline = async (req, res) => {
  req.body.isOnline = true;
  return exports.updateDriverOnlineStatus(req, res);
};

exports.setDriverOffline = async (req, res) => {
  req.body.isOnline = false;
  return exports.updateDriverOnlineStatus(req, res);
};