const { Category, Restaurant, Food } = require("../models");

const normalizeCategory = (item) => ({
  id: item.id,
  restaurantId: item.restaurantId,
  name: item.name,
});

exports.getAllCategories = async (req, res) => {
  try {
    const { restaurantId } = req.query;
    const whereClause = {};
    if (restaurantId !== undefined) {
      const parsedId = Number(restaurantId);
      if (!Number.isFinite(parsedId)) {
        return res.status(400).json({ message: "Invalid restaurantId" });
      }
      whereClause.restaurantId = parsedId;
    }
    const items = await Category.findAll({
      where: whereClause,
      order: [["id", "ASC"]],
    });
    res.json({ data: items.map(normalizeCategory) });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

exports.getCategoryById = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await Category.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Category not found" });
    }

    return res.json({ data: normalizeCategory(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createCategory = async (req, res) => {
  try {
    const { name, restaurantId } = req.body;

    const trimmedName = typeof name === "string" ? name.trim() : "";

    if (!trimmedName || !Number.isFinite(Number(restaurantId))) {
      return res.status(400).json({ message: "name and restaurantId are required" });
    }

    const restaurant = await Restaurant.findByPk(Number(restaurantId));
    if (!restaurant) {
      return res.status(400).json({ message: "Restaurant not found" });
    }

    const newCategory = await Category.create({
      restaurantId: Number(restaurantId),
      name: trimmedName,
    });

    return res.status(201).json({ message: "Created", data: normalizeCategory(newCategory) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const { name, restaurantId } = req.body;
    const item = await Category.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Category not found" });
    }

    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName && restaurantId === undefined) {
      return res.status(400).json({ message: "Nothing to update" });
    }

    let nextRestaurantId = item.restaurantId;
    if (restaurantId !== undefined) {
      const parsedId = Number(restaurantId);
      if (!Number.isFinite(parsedId)) {
        return res.status(400).json({ message: "Invalid restaurantId" });
      }
      nextRestaurantId = parsedId;
      if (nextRestaurantId !== item.restaurantId) {
        const restaurant = await Restaurant.findByPk(nextRestaurantId);
        if (!restaurant) {
          return res.status(400).json({ message: "Restaurant not found" });
        }
      }
    }

    await item.update({
      name: trimmedName || item.name,
      restaurantId: nextRestaurantId,
    });

    return res.json({ message: "Updated", data: normalizeCategory(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.deleteCategory = async (req, res) => {
  try {
    const id = Number(req.params.id);
    const item = await Category.findByPk(id);

    if (!item) {
      return res.status(404).json({ message: "Category not found" });
    }

    // Guard to prevent accidental deletion if there are associated food items
    const foodCount = await Food.count({ where: { categoryId: id } });
    if (foodCount > 0) {
      return res.status(409).json({ message: "Cannot delete category containing food items" });
    }

    await item.destroy();
    return res.json({ message: "Deleted", data: normalizeCategory(item) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
