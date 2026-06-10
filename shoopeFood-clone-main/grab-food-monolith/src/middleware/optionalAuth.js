const { verifyAuthToken } = require("../utils/authToken");

module.exports = (req, _res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  if (!token) {
    return next();
  }

  try {
    const payload = verifyAuthToken(token);
    req.user = {
      id: Number(payload.sub),
      phone: payload.phone,
      role: payload.role,
      roles: payload.roles || [],
      token,
    };
  } catch (_error) {
    // Public endpoints keep working when a stale optional token is present.
  }

  return next();
};
