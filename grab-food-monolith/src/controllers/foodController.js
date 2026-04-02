const { Op } = require("sequelize");
const { Food, Category } = require("../models");

const normalizeFood = (item) => ({
  id: item.id,
  categoryId: item.categoryId,
  name: item.name,
  price: Number(item.price),
  isAvailable: Boolean(item.isAvailable),
});

exports.getAllFoods = async (req, res) => {
  try {
    const { restaurantId, categoryId, name, isAvailable } = req.query;
    
    const whereClause = {};
    if (categoryId !== undefined) {
      const parsedCategoryId = Number(categoryId);
      if (!Number.isFinite(parsedCategoryId)) {
        return res.status(400).json({ message: "Invalid categoryId" });
      }
      whereClause.categoryId = parsedCategoryId;
    }
    if (name) {
      whereClause.name = { [Op.like]: `%${name}%` };
    }
    if (isAvailable !== undefined) {
      if (isAvailable !== 'true' && isAvailable !== 'false') {
        return res.status(400).json({ message: "isAvailable must be 'true' or 'false'" });
      }
      whereClause.isAvailable = isAvailable === 'true';
    }

    const includeOptions = [];
    if (restaurantId !== undefined) {
      const parsedRestaurantId = Number(restaurantId);
      if (!Number.isFinite(parsedRestaurantId)) {
        return res.status(400).json({ message: "Invalid restaurantId" });
      }
      includeOptions.push({
        model: Category,
        as: 'category',
        where: { restaurantId: parsedRestaurantId },
        attributes: []
      });
    }

    const items = await Food.findAll({ 
      where: whereClause,
      include: includeOptions,
      order: [["id", "ASC"]] 
    });
    
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

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const parsedPrice = Number(price);

    if (!trimmedName || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ message: "valid name and non-negative price are required" });
    }

    let parsedCategoryId = null;
    if (categoryId !== undefined && categoryId !== null && Number.isFinite(Number(categoryId))) {
      parsedCategoryId = Number(categoryId);
      const category = await Category.findByPk(parsedCategoryId);
      if (!category) {
        return res.status(400).json({ message: "Category not found" });
      }
    }

    const newFood = await Food.create({
      categoryId: parsedCategoryId,
      name: trimmedName,
      price: parsedPrice,
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

    let trimmedName = item.name;
    if (name !== undefined) {
      trimmedName = typeof name === "string" ? name.trim() : "";
      if (!trimmedName) {
        return res.status(400).json({ message: "name cannot be empty" });
      }
    }

    let parsedPrice = item.price;
    if (price !== undefined) {
      parsedPrice = Number(price);
      if (!Number.isFinite(parsedPrice) || parsedPrice < 0) {
        return res.status(400).json({ message: "price must be non-negative" });
      }
    }

    let nextCategoryId = item.categoryId;
    if (categoryId !== undefined) {
      if (categoryId === null) {
        nextCategoryId = null;
      } else {
        const parsedCategoryId = Number(categoryId);
        if (!Number.isFinite(parsedCategoryId)) {
          return res.status(400).json({ message: "Invalid categoryId" });
        }
        nextCategoryId = parsedCategoryId;
        if (nextCategoryId !== item.categoryId) {
          const category = await Category.findByPk(nextCategoryId);
          if (!category) {
            return res.status(400).json({ message: "Category not found" });
          }
        }
      }
    }

    await item.update({
      name: trimmedName,
      price: parsedPrice,
      categoryId: nextCategoryId,
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
