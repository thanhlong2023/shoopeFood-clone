const { resolveUserRoles } = require("../utils/roleResolver");

module.exports = (allowedRoles = []) => {
  const normalizedRoles = allowedRoles.map((role) => String(role).toUpperCase());

  return async (req, res, next) => {
    try {
      const { hasRole } = await resolveUserRoles(req);

      if (!hasRole(normalizedRoles)) {
        return res.status(403).json({ message: "Forbidden" });
      }

      return next();
    } catch (error) {
      return res.status(500).json({ message: error.message });
    }
  };
};
