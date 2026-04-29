const { verifyAuthToken } = require("../utils/authToken");

module.exports = (req, res, next) => {
  const authHeader = req.headers.authorization || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
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

    return next();
  } catch (error) {
    return res.status(401).json({ message: error.message || "Unauthorized" });
  }
};
