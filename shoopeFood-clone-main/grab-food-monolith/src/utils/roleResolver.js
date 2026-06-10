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
  const activeRole = normalizeRoleName(req.user?.role);

  if (!req.user?.id) {
    return {
      user: null,
      activeRole: "",
      assignedRoles: [],
      roles: [],
      hasActiveRole: () => false,
      hasAssignedRole: () => false,
      hasRole: () => false,
    };
  }

  const user = await User.findByPk(req.user.id, { include: roleInclude });
  const assignedRoles = (user?.roles || []).map((role) => normalizeRoleName(role.name)).filter(Boolean);

  const hasActiveRole = (allowedRoles = []) => {
    const normalized = allowedRoles.map(normalizeRoleName);
    return normalized.includes(activeRole);
  };

  const hasAssignedRole = (allowedRoles = []) => {
    const normalized = allowedRoles.map(normalizeRoleName);
    return normalized.some((role) => assignedRoles.includes(role));
  };

  return {
    user,
    activeRole,
    assignedRoles,
    roles: assignedRoles,
    hasActiveRole,
    hasAssignedRole,
    hasRole: hasActiveRole,
  };
};

module.exports = {
  resolveUserRoles,
};
