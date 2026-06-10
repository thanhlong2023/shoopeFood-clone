const { Role, UserRole } = require("../models");

const setUserRole = async (userId, roleName) => {
  const role = await Role.findOne({ where: { name: roleName } });
  if (!role) {
    throw new Error(`${roleName} role is not configured`);
  }

  const existing = await UserRole.findAll({ where: { userId } });
  if (existing.length === 1 && Number(existing[0].roleId) === Number(role.id)) {
    return roleName;
  }

  await UserRole.destroy({ where: { userId } });
  await UserRole.create({ userId, roleId: role.id });

  return roleName;
};

exports.setUserRole = setUserRole;
exports.assignMerchantRole = (userId) => setUserRole(userId, "MERCHANT");
exports.assignDriverRole = (userId) => setUserRole(userId, "DRIVER");
