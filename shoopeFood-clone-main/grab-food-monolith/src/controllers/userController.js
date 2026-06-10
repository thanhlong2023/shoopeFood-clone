const { User, Role, UserRole, Restaurant } = require("../models");
const { resolveUserRoles } = require("../utils/roleResolver");

const normalizeUser = (item) => ({
  id: item.id,
  fullName: item.fullName || "",
  phone: item.phone || "",
  ratingAvg: Number(item.ratingAvg || 0),
  roles: item.roles ? item.roles.map((role) => role.name) : [],
  createdAt: item.createdAt,
});

const userInclude = [{ model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } }];

const SUPPORTED_ROLES = new Set(["CUSTOMER", "DRIVER", "MERCHANT", "ADMIN"]);

const normalizeRoleNames = (rolesInput, fallbackRole) => {
  const raw = rolesInput !== undefined && rolesInput !== null
    ? (Array.isArray(rolesInput) ? rolesInput : [rolesInput])
    : fallbackRole
      ? [fallbackRole]
      : [];

  const normalized = [...new Set(
    raw
      .map((role) => String(role || "").trim().toUpperCase())
      .filter((role) => SUPPORTED_ROLES.has(role)),
  )];

  return normalized;
};

const { setUserRole } = require("../utils/roleAssignment");

const assignUserRoles = async (userId, rolesInput, fallbackRole) => {
  const roleNames = normalizeRoleNames(rolesInput, fallbackRole);
  if (roleNames.length === 0) {
    throw new Error("At least one valid role is required");
  }

  const roleName = roleNames[0];
  await setUserRole(userId, roleName);

  return [roleName];
};

const findUserWithRoles = (id) => User.findByPk(id, { include: userInclude });

exports.getProfile = (req, res) => {
  res.json({ message: "User profile endpoint", user: req.user || null });
};

const merchantInclude = {
  model: Role,
  as: "roles",
  where: { name: "MERCHANT" },
  required: true,
  through: { attributes: [] },
  attributes: ["id", "name"],
};

exports.listMerchants = async (req, res) => {
  try {
    const { hasRole } = await resolveUserRoles(req);
    if (!hasRole(["ADMIN"])) {
      return res.status(403).json({ message: "Forbidden" });
    }

    const [merchantUsers, ownerRows] = await Promise.all([
      User.findAll({
        include: [merchantInclude],
        order: [["id", "ASC"]],
      }),
      Restaurant.findAll({
        where: { deletedAt: null },
        attributes: ["ownerId"],
        raw: true,
      }),
    ]);

    const ownerIds = [...new Set(ownerRows.map((row) => row.ownerId).filter(Boolean))];
    const missingOwnerIds = ownerIds.filter((ownerId) => !merchantUsers.some((user) => user.id === ownerId));

    const ownerUsers =
      missingOwnerIds.length > 0
        ? await User.findAll({
            where: { id: missingOwnerIds },
            include: [userInclude[0]],
            order: [["id", "ASC"]],
          })
        : [];

    const merged = [...merchantUsers, ...ownerUsers].filter(
      (user, index, list) => list.findIndex((item) => item.id === user.id) === index,
    );

    return res.json({ message: "Merchants fetched", data: merged.map(normalizeUser) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createMerchant = async (req, res) => {
  try {
    const { fullName, phone, password = "123456", ratingAvg = 5.0 } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({ message: "fullName and phone are required" });
    }

    const existing = await User.findOne({ where: { phone: String(phone).trim() } });
    if (existing) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    const newUser = await User.create({
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      password: String(password).trim() || "123456",
      ratingAvg: Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : 5.0,
    });

    await setUserRole(newUser.id, "MERCHANT");

    const created = await User.findByPk(newUser.id, { include: userInclude });
    return res.status(201).json({ message: "Merchant created", data: normalizeUser(created) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getUsers = async (req, res) => {
  try {
    const items = await User.findAll({ include: userInclude, order: [["id", "ASC"]] });
    res.json({ data: items.map(normalizeUser) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await User.findByPk(id, { include: userInclude });

    if (!item) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ data: normalizeUser(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { fullName, phone, password = "123456", ratingAvg = 5.0, role, roles } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({ message: "fullName and phone are required" });
    }

    const existing = await User.findOne({ where: { phone: String(phone).trim() } });
    if (existing) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    const newUser = await User.create({
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      password: String(password).trim() || "123456",
      ratingAvg: Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : 5.0,
    });

    await assignUserRoles(newUser.id, roles ?? role, "CUSTOMER");
    const created = await findUserWithRoles(newUser.id);

    return res.status(201).json({ message: "Created", data: normalizeUser(created) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { fullName, phone, password, ratingAvg, role, roles } = req.body;
    const item = await User.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!fullName || !phone) {
      return res.status(400).json({ message: "fullName and phone are required" });
    }

    await item.update({
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      password: password !== undefined ? String(password).trim() : item.password,
      ratingAvg: ratingAvg !== undefined && Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : item.ratingAvg,
    });

    if (role !== undefined || roles !== undefined) {
      await assignUserRoles(item.id, roles ?? role);
    }

    const updated = await findUserWithRoles(item.id);
    return res.json({ message: "Updated", data: normalizeUser(updated) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await User.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "User not found" });
    }

    await item.destroy();
    return res.json({ message: "Deleted", data: normalizeUser(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
