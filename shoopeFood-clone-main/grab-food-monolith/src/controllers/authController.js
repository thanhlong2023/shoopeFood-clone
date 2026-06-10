const { User, Role, UserRole } = require("../models");
const { createAuthToken } = require("../utils/authToken");

const SUPPORTED_ROLES = new Set(["CUSTOMER", "DRIVER", "MERCHANT", "ADMIN"]);

const normalizeRole = (role) => String(role || "").trim().toUpperCase();

const normalizeAuthUser = (user, selectedRole) => {
  const assignedRoles = (user.roles || []).map((role) => role.name);
  const role = selectedRole && assignedRoles.includes(selectedRole)
    ? selectedRole
    : assignedRoles[0] || selectedRole || "CUSTOMER";

  return {
    id: user.id,
    fullName: user.fullName || "",
    phone: user.phone || "",
    ratingAvg: Number(user.ratingAvg || 0),
    roles: [role],
    role,
    createdAt: user.createdAt,
  };
};

const findUserByPhone = (phone) =>
  User.findOne({
    where: { phone },
    include: [{ model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } }],
  });

exports.login = async (req, res) => {
  try {
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");
    const requestedRole = normalizeRole(req.body.role);

    if (!phone || !password || !SUPPORTED_ROLES.has(requestedRole)) {
      return res.status(400).json({ message: "phone, password and valid role are required" });
    }

    const user = await findUserByPhone(phone);
    if (!user || String(user.password) !== password) {
      return res.status(401).json({ message: "Invalid phone or password" });
    }

    const roleNames = (user.roles || []).map((role) => role.name);
    const accountRole = roleNames[0];

    if (!accountRole) {
      return res.status(403).json({ message: "User has no role assigned" });
    }

    if (requestedRole !== accountRole) {
      return res.status(403).json({
        message: `Tai khoan nay chi dang nhap duoc voi role ${accountRole}`,
      });
    }

    const token = createAuthToken({
      sub: user.id,
      phone: user.phone,
      role: accountRole,
      roles: [accountRole],
    });

    return res.json({
      message: "Logged in",
      data: {
        token,
        user: normalizeAuthUser(user, accountRole),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.register = async (req, res) => {
  try {
    const fullName = String(req.body.fullName || "").trim();
    const phone = String(req.body.phone || "").trim();
    const password = String(req.body.password || "");

    if (!fullName || !phone || !password) {
      return res.status(400).json({ message: "fullName, phone and password are required" });
    }

    if (password.length < 6) {
      return res.status(400).json({ message: "password must be at least 6 characters" });
    }

    const existing = await User.findOne({ where: { phone } });
    if (existing) {
      return res.status(400).json({ message: "Phone number already exists" });
    }

    const customerRole = await Role.findOne({ where: { name: "CUSTOMER" } });
    if (!customerRole) {
      return res.status(500).json({ message: "CUSTOMER role is not configured" });
    }

    const newUser = await User.create({
      fullName,
      phone,
      password,
      ratingAvg: 5.0,
    });

    await UserRole.create({ userId: newUser.id, roleId: customerRole.id });

    const user = await findUserByPhone(phone);
    const token = createAuthToken({
      sub: user.id,
      phone: user.phone,
      role: "CUSTOMER",
      roles: ["CUSTOMER"],
    });

    return res.status(201).json({
      message: "Registered",
      data: {
        token,
        user: normalizeAuthUser(user, "CUSTOMER"),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateProfile = async (req, res) => {
  try {
    const { fullName, phone } = req.body;
    const trimmedName = String(fullName || "").trim();
    const trimmedPhone = String(phone || "").trim();

    if (!trimmedName || !trimmedPhone) {
      return res.status(400).json({ message: "fullName and phone are required" });
    }

    const user = await User.findByPk(req.user.id, {
      include: [{ model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (trimmedPhone !== user.phone) {
      const existing = await User.findOne({ where: { phone: trimmedPhone } });
      if (existing && existing.id !== user.id) {
        return res.status(400).json({ message: "Phone number already exists" });
      }
    }

    await user.update({
      fullName: trimmedName,
      phone: trimmedPhone,
    });

    return res.json({
      message: "Profile updated",
      data: normalizeAuthUser(user, req.user.role),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [{ model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({
      data: normalizeAuthUser(user, req.user.role),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.activateRole = async (req, res) => {
  try {
    const requestedRole = normalizeRole(req.body.role);

    if (!SUPPORTED_ROLES.has(requestedRole)) {
      return res.status(400).json({ message: "Invalid role" });
    }

    const user = await User.findByPk(req.user.id, {
      include: [{ model: Role, as: "roles", attributes: ["id", "name"], through: { attributes: [] } }],
    });

    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const roleNames = (user.roles || []).map((role) => role.name);
    const accountRole = roleNames[0];

    if (!accountRole) {
      return res.status(403).json({ message: "User has no role assigned" });
    }

    if (requestedRole !== accountRole) {
      return res.status(403).json({
        message: `Tai khoan hien tai chi co role ${accountRole}`,
      });
    }

    const token = createAuthToken({
      sub: user.id,
      phone: user.phone,
      role: accountRole,
      roles: [accountRole],
    });

    return res.json({
      message: "Role synced",
      data: {
        token,
        user: normalizeAuthUser(user, accountRole),
      },
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
