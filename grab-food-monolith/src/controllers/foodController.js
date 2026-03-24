const { Food } = require("../models");

const normalizeFood = (item) => ({
  id: item.id,
  categoryId: item.categoryId,
  name: item.name,
  price: Number(item.price),
  isAvailable: Boolean(item.isAvailable),
});

exports.getAllFoods = async (req, res) => {
  try {
    const items = await Food.findAll({ order: [["id", "ASC"]] });
    res.json({ data: items.map(normalizeFood) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getFoodById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await Food.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Food not found" });
    }

    return res.json({ data: normalizeFood(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createFood = async (req, res) => {
  try {
    const { name, price, categoryId, isAvailable = true } = req.body;

    if (!name || !Number.isFinite(Number(price))) {
      return res.status(400).json({ message: "name and price are required" });
    }

    const newFood = await Food.create({
      categoryId: Number.isFinite(Number(categoryId)) ? Number(categoryId) : null,
      name: String(name).trim(),
      price: Number(price),
      isAvailable: typeof isAvailable === "boolean" ? isAvailable : true,
    });

    return res.status(201).json({ message: "Created", data: normalizeFood(newFood) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateFood = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, price, categoryId, isAvailable } = req.body;
    const item = await Food.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Food not found" });
    }

    if (!name || !Number.isFinite(Number(price))) {
      return res.status(400).json({ message: "name and price are required" });
    }

    await item.update({
      name: String(name).trim(),
      price: Number(price),
      categoryId: categoryId !== undefined && Number.isFinite(Number(categoryId)) ? Number(categoryId) : item.categoryId,
      isAvailable: typeof isAvailable === "boolean" ? isAvailable : item.isAvailable,
    });

    return res.json({ message: "Updated", data: normalizeFood(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteFood = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await Food.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Food not found" });
    }

    await item.destroy();
    return res.json({ message: "Deleted", data: normalizeFood(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
