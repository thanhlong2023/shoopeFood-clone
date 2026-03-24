const { User } = require("../models");

const normalizeUser = (item) => ({
  id: item.id,
  fullName: item.fullName || "",
  phone: item.phone || "",
  ratingAvg: Number(item.ratingAvg || 0),
  createdAt: item.createdAt,
});

exports.getProfile = (req, res) => {
  res.json({ message: "User profile endpoint", user: req.user || null });
};

exports.getUsers = async (req, res) => {
  try {
    const items = await User.findAll({ order: [["id", "ASC"]] });
    res.json({ data: items.map(normalizeUser) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getUserById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await User.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "User not found" });
    }

    return res.json({ data: normalizeUser(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createUser = async (req, res) => {
  try {
    const { fullName, phone, password = "123456", ratingAvg = 5.0 } = req.body;

    if (!fullName || !phone) {
      return res.status(400).json({ message: "fullName and phone are required" });
    }

    const newUser = await User.create({
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      password: String(password).trim() || "123456",
      ratingAvg: Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : 5.0,
    });

    return res.status(201).json({ message: "Created", data: normalizeUser(newUser) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { fullName, phone, password, ratingAvg } = req.body;
    const item = await User.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!fullName || !phone) {
      return res.status(400).json({ message: "fullName and phone are required" });
    }

    await item.update({
      fullName: String(fullName).trim(),
      phone: String(phone).trim(),
      password: password !== undefined ? String(password).trim() : item.password,
      ratingAvg: ratingAvg !== undefined && Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : item.ratingAvg,
    });

    return res.json({ message: "Updated", data: normalizeUser(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await User.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "User not found" });
    }

    await item.destroy();
    return res.json({ message: "Deleted", data: normalizeUser(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
