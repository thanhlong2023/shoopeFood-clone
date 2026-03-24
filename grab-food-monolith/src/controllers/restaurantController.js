const { Restaurant } = require("../models");

const normalizeRestaurant = (item) => ({
  id: item.id,
  name: item.name,
  address: item.address || "",
  rating: item.isOpen ? 5 : 4,
});

exports.listRestaurants = async (req, res) => {
  try {
    const items = await Restaurant.findAll({ order: [["id", "ASC"]] });
    res.json({ data: items.map(normalizeRestaurant) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getRestaurantById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await Restaurant.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    return res.json({ data: normalizeRestaurant(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createRestaurant = async (req, res) => {
  try {
    const { name, address, ownerId, latitude = 0, longitude = 0 } = req.body;

    if (!name || !address) {
      return res.status(400).json({ message: "name and address are required" });
    }

    const newRestaurant = await Restaurant.create({
      ownerId: Number(ownerId) || 1,
      name: String(name).trim(),
      address: String(address).trim(),
      latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : 0,
      longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : 0,
      isOpen: true,
    });

    return res.status(201).json({ message: "Created", data: normalizeRestaurant(newRestaurant) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, address, latitude, longitude, isOpen } = req.body;
    const item = await Restaurant.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (!name || !address) {
      return res.status(400).json({ message: "name and address are required" });
    }

    await item.update({
      name: String(name).trim(),
      address: String(address).trim(),
      latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : item.latitude,
      longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : item.longitude,
      isOpen: typeof isOpen === "boolean" ? isOpen : item.isOpen,
    });

    return res.json({ message: "Updated", data: normalizeRestaurant(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteRestaurant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await Restaurant.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    await item.destroy();
    return res.json({ message: "Deleted", data: normalizeRestaurant(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
