const { User, Role } = require("../models");
const { createAuthToken } = require("../utils/authToken");

const SUPPORTED_ROLES = new Set(["CUSTOMER", "DRIVER", "MERCHANT", "ADMIN"]);

const normalizeRole = (role) => String(role || "").trim().toUpperCase();

const normalizeAuthUser = (user, selectedRole) => {
  const roles = (user.roles || []).map((role) => role.name);

  return {
    id: user.id,
    fullName: user.fullName || "",
    phone: user.phone || "",
    ratingAvg: Number(user.ratingAvg || 0),
    roles,
    role: selectedRole || roles[0] || "CUSTOMER",
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
    if (!roleNames.includes(requestedRole)) {
      return res.status(403).json({ message: `User does not have ${requestedRole} role` });
    }

    const token = createAuthToken({
      sub: user.id,
      phone: user.phone,
      role: requestedRole,
      roles: roleNames,
    });

    return res.json({
      message: "Logged in",
      data: {
        token,
        user: normalizeAuthUser(user, requestedRole),
      },
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
