const { User, DriverDetail, Restaurant } = require("../models");
const { resolveUserRoles } = require("../utils/roleResolver");
const { assignDriverRole } = require("../utils/roleAssignment");

const normalizeDriverApplication = (item, user) => ({
  userId: item.userId,
  fullName: user ? user.fullName : "",
  phone: user ? user.phone : "",
  licensePlate: item.licensePlate || "",
  idCardNumber: item.idCardNumber || "",
  vehicleType: item.vehicleType || "",
  approvalStatus: item.approvalStatus || "PENDING",
  rejectReason: item.rejectReason || null,
});

exports.applyDriver = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const licensePlate = String(req.body.licensePlate || "").trim().toUpperCase();
    const idCardNumber = String(req.body.idCardNumber || "").trim();
    const vehicleType = String(req.body.vehicleType || "Motorbike").trim();

    if (!licensePlate || !idCardNumber) {
      return res.status(400).json({ message: "licensePlate and idCardNumber are required" });
    }

    const { activeRole, hasAssignedRole } = await resolveUserRoles(req);
    if (activeRole !== "CUSTOMER") {
      return res.status(400).json({ message: "Chi tai khoan CUSTOMER moi duoc dang ky tai xe" });
    }

    if (hasAssignedRole(["DRIVER"])) {
      return res.status(400).json({ message: "You are already a driver" });
    }

    const existing = await DriverDetail.findByPk(userId);
    if (existing && existing.approvalStatus === "PENDING") {
      return res.status(400).json({ message: "Driver application is already pending review" });
    }

    if (existing && existing.approvalStatus === "APPROVED") {
      return res.status(400).json({ message: "You are already an approved driver" });
    }

    if (existing) {
      await existing.update({
        licensePlate,
        idCardNumber,
        vehicleType,
        approvalStatus: "PENDING",
        rejectReason: null,
        isOnline: false,
      });
    } else {
      await DriverDetail.create({
        userId,
        licensePlate,
        idCardNumber,
        vehicleType,
        approvalStatus: "PENDING",
        isOnline: false,
      });
    }

    const user = await User.findByPk(userId);
    const record = await DriverDetail.findByPk(userId);
    return res.status(201).json({
      message: "Driver application submitted",
      data: normalizeDriverApplication(record, user),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.applyMerchant = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const {
      name,
      address,
      latitude = 10.7769,
      longitude = 106.7009,
      openingTime = "07:00:00",
      closingTime = "22:00:00",
      imageUrl = null,
    } = req.body;

    const trimmedName = String(name || "").trim();
    const trimmedAddress = String(address || "").trim();

    if (!trimmedName || !trimmedAddress) {
      return res.status(400).json({ message: "name and address are required" });
    }

    const { activeRole, hasAssignedRole } = await resolveUserRoles(req);
    if (activeRole !== "CUSTOMER") {
      return res.status(400).json({ message: "Chi tai khoan CUSTOMER moi duoc dang ky mo quan" });
    }

    if (hasAssignedRole(["MERCHANT"])) {
      return res.status(400).json({ message: "You are already a merchant" });
    }

    const pendingRestaurant = await Restaurant.findOne({
      where: { ownerId: userId, approvalStatus: "PENDING", deletedAt: null },
    });

    if (pendingRestaurant) {
      return res.status(400).json({ message: "You already have a restaurant application pending review" });
    }

    const restaurant = await Restaurant.create({
      ownerId: userId,
      name: trimmedName,
      address: trimmedAddress,
      latitude: Number(latitude) || 0,
      longitude: Number(longitude) || 0,
      openingTime,
      closingTime,
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      approvalStatus: "PENDING",
      isOpen: false,
      isOpenToday: false,
    });

    return res.status(201).json({
      message: "Restaurant application submitted",
      data: {
        id: restaurant.id,
        name: restaurant.name,
        approvalStatus: restaurant.approvalStatus,
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getMyApplicationStatus = async (req, res) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized" });
    }

    const { roles: roleNames } = await resolveUserRoles(req);

    const [driver, pendingRestaurant, approvedRestaurant] = await Promise.all([
      DriverDetail.findByPk(userId),
      Restaurant.findOne({
        where: { ownerId: userId, approvalStatus: "PENDING", deletedAt: null },
        attributes: ["id", "name", "approvalStatus"],
      }),
      Restaurant.findOne({
        where: { ownerId: userId, approvalStatus: "APPROVED", deletedAt: null },
        order: [["id", "DESC"]],
        attributes: ["id", "name", "approvalStatus"],
      }),
    ]);

    const accountRole = roleNames[0] || null;

    return res.json({
      data: {
        role: accountRole,
        roles: accountRole ? [accountRole] : [],
        driver: driver
          ? {
              approvalStatus: driver.approvalStatus || "PENDING",
              rejectReason: driver.rejectReason || null,
            }
          : null,
        merchant: {
          pendingRestaurant: pendingRestaurant
            ? {
                id: pendingRestaurant.id,
                name: pendingRestaurant.name,
                approvalStatus: pendingRestaurant.approvalStatus,
              }
            : null,
          approvedRestaurant: approvedRestaurant
            ? {
                id: approvedRestaurant.id,
                name: approvedRestaurant.name,
                approvalStatus: approvedRestaurant.approvalStatus,
              }
            : null,
        },
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.listPendingDrivers = async (req, res) => {
  try {
    const items = await DriverDetail.findAll({
      where: { approvalStatus: "PENDING" },
      include: [{ model: User, as: "driverUser", attributes: ["id", "fullName", "phone"] }],
      order: [["userId", "ASC"]],
    });

    return res.json({
      data: items.map((item) => normalizeDriverApplication(item, item.driverUser)),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.approveDriver = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const item = await DriverDetail.findByPk(userId, {
      include: [{ model: User, as: "driverUser", attributes: ["id", "fullName", "phone"] }],
    });

    if (!item) {
      return res.status(404).json({ message: "Driver application not found" });
    }

    if (item.approvalStatus !== "PENDING") {
      return res.status(400).json({ message: `Application is already ${item.approvalStatus}` });
    }

    await item.update({
      approvalStatus: "APPROVED",
      rejectReason: null,
    });

    await assignDriverRole(userId);

    return res.json({
      message: "Driver approved",
      data: normalizeDriverApplication(item, item.driverUser),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.rejectDriver = async (req, res) => {
  try {
    const userId = Number(req.params.userId);
    const { reason } = req.body;
    const item = await DriverDetail.findByPk(userId);

    if (!item) {
      return res.status(404).json({ message: "Driver application not found" });
    }

    if (item.approvalStatus !== "PENDING") {
      return res.status(400).json({ message: `Application is already ${item.approvalStatus}` });
    }

    await item.update({
      approvalStatus: "REJECTED",
      rejectReason: reason ? String(reason).trim() : null,
      isOnline: false,
    });

    return res.json({ message: "Driver application rejected" });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

