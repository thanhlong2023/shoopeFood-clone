const { Restaurant, User } = require("../models");

const normalizeRestaurant = (item) => ({
  id: item.id,
  ownerId: item.ownerId,
  name: item.name,
  address: item.address || "",
  latitude: Number(item.latitude || 0),
  longitude: Number(item.longitude || 0),
  isOpen: Boolean(item.isOpen),
  imageUrl: item.imageUrl || null,
  ratingAvg: Number(item.ratingAvg || 0),
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
    const { name, address, ownerId, latitude = 0, longitude = 0, isOpen = true, imageUrl = null, ratingAvg = 5.0 } = req.body;

    if (!name || !address) {
      return res.status(400).json({ message: "name and address are required" });
    }

    const normalizedOwnerId = Number(ownerId) || 1;
    const owner = await User.findByPk(normalizedOwnerId);
    if (!owner) {
      return res.status(400).json({ message: "owner not found" });
    }

    const newRestaurant = await Restaurant.create({
      ownerId: normalizedOwnerId,
      name: String(name).trim(),
      address: String(address).trim(),
      latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : 0,
      longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : 0,
      isOpen: Boolean(isOpen),
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      ratingAvg: Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : 5.0,
    });

    return res.status(201).json({ message: "Created", data: normalizeRestaurant(newRestaurant) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateRestaurant = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, address, ownerId, latitude, longitude, isOpen, imageUrl, ratingAvg } = req.body;
    const item = await Restaurant.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Restaurant not found" });
    }

    if (!name || !address) {
      return res.status(400).json({ message: "name and address are required" });
    }

    const nextOwnerId = ownerId !== undefined && Number.isFinite(Number(ownerId)) ? Number(ownerId) : item.ownerId;
    if (nextOwnerId !== item.ownerId) {
      const owner = await User.findByPk(nextOwnerId);
      if (!owner) {
        return res.status(400).json({ message: "owner not found" });
      }
    }

    await item.update({
      name: String(name).trim(),
      address: String(address).trim(),
      ownerId: nextOwnerId,
      latitude: Number.isFinite(Number(latitude)) ? Number(latitude) : item.latitude,
      longitude: Number.isFinite(Number(longitude)) ? Number(longitude) : item.longitude,
      isOpen: typeof isOpen === "boolean" ? isOpen : item.isOpen,
      imageUrl: imageUrl !== undefined ? (imageUrl ? String(imageUrl).trim() : null) : item.imageUrl,
      ratingAvg: ratingAvg !== undefined && Number.isFinite(Number(ratingAvg)) ? Number(ratingAvg) : item.ratingAvg,
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
