const { User, Role } = require("../models");

const roleInclude = [
  {
    model: Role,
    as: "roles",
    attributes: ["id", "name"],
    through: { attributes: [] },
  },
];

const normalizeRoleName = (role) => String(role || "").trim().toUpperCase();

const resolveUserRoles = async (req) => {
  const sessionRole = normalizeRoleName(req.user?.role);
  const tokenRoles = (req.user?.roles || []).map(normalizeRoleName).filter(Boolean);

  if (!req.user?.id) {
    return {
      user: null,
      roles: [],
      hasRole: () => false,
    };
  }

  const user = await User.findByPk(req.user.id, { include: roleInclude });
  const dbRoles = (user?.roles || []).map((role) => normalizeRoleName(role.name)).filter(Boolean);
  const roles = [...new Set([sessionRole, ...tokenRoles, ...dbRoles].filter(Boolean))];

  return {
    user,
    roles,
    hasRole: (allowedRoles = []) => {
      const normalized = allowedRoles.map(normalizeRoleName);
      return normalized.some((role) => roles.includes(role));
    },
  };
};

module.exports = {
  resolveUserRoles,
};
