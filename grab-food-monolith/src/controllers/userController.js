const { User } = require("../models");

const mapRoleToDb = (role = "customer") => {
  const value = String(role).trim().toUpperCase();
  if (["CUSTOMER", "DRIVER", "MERCHANT", "ADMIN"].includes(value)) {
    return value;
  }
  return "CUSTOMER";
};

const normalizeUser = (item) => ({
  id: item.id,
  name: item.fullName || "",
  email: item.phone || "",
  role: String(item.role || "CUSTOMER").toLowerCase(),
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
    const { name, email, role = "customer" } = req.body;

    if (!name || !email) {
      return res.status(400).json({ message: "name and email are required" });
    }

    const newUser = await User.create({
      fullName: String(name).trim(),
      phone: String(email).trim(),
      password: "123456",
      role: mapRoleToDb(role),
    });

    return res.status(201).json({ message: "Created", data: normalizeUser(newUser) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateUser = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, email, role = "customer" } = req.body;
    const item = await User.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "User not found" });
    }

    if (!name || !email) {
      return res.status(400).json({ message: "name and email are required" });
    }

    await item.update({
      fullName: String(name).trim(),
      phone: String(email).trim(),
      role: mapRoleToDb(role),
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
