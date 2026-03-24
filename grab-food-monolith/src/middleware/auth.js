module.exports = (req, res, next) => {
  const token = req.headers.authorization;

  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  req.user = {
    id: 1,
    role: "admin",
    token,
  };

  next();
};
