module.exports = (allowedRoles = []) => {
  const normalizedRoles = allowedRoles.map((role) => String(role).toUpperCase());

  return (req, res, next) => {
    if (!req.user || !normalizedRoles.includes(String(req.user.role || "").toUpperCase())) {
      return res.status(403).json({ message: "Forbidden" });
    }
    next();
  };
};
