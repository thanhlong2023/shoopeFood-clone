const { Op } = require("sequelize");
const { Food, Category, Topping } = require("../models");

const normalizeFood = (item) => ({
  id: item.id,
  categoryId: item.categoryId,
  name: item.name,
  imageUrl: item.imageUrl || null,
  price: Number(item.price),
  isAvailable: Boolean(item.isAvailable),
  defaultQuantity: Number(item.defaultQuantity || 0),
  currentQuantity: Number(item.currentQuantity || 0),
  quantityResetDate: item.quantityResetDate || null,
  toppings: item.toppings ? item.toppings.map(t => ({
    id: t.id,
    restaurantId: t.restaurantId,
    name: t.name,
    price: Number(t.price),
    isAvailable: Boolean(t.isAvailable),
    defaultQuantity: Number(t.defaultQuantity || 0),
    currentQuantity: Number(t.currentQuantity || 0),
    startDate: t.startDate || null,
    endDate: t.endDate || null
  })) : [],
});

const parseOptionalNonNegativeInteger = (value, fieldName) => {
  if (value === undefined) {
    return { value: undefined };
  }

  const parsedValue = Number(value);
  if (!Number.isInteger(parsedValue) || parsedValue < 0) {
    return { error: `${fieldName} must be a non-negative integer` };
  }

  return { value: parsedValue };
};

exports.getAllFoods = async (req, res) => {
  try {
    await Food.resetExpiredDailyQuantities();
    await Topping.resetExpiredDailyQuantities();

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

    includeOptions.push({
      model: Topping,
      as: 'toppings',
      through: { attributes: [] }
    });

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
    await Food.resetExpiredDailyQuantities();
    await Topping.resetExpiredDailyQuantities();

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
    const { name, price, categoryId, imageUrl = null, isAvailable = true, defaultQuantity = 0, currentQuantity } = req.body;

    const trimmedName = typeof name === "string" ? name.trim() : "";
    const parsedPrice = Number(price);
    const parsedDefaultQuantity = parseOptionalNonNegativeInteger(defaultQuantity, "defaultQuantity");
    const parsedCurrentQuantity = parseOptionalNonNegativeInteger(currentQuantity, "currentQuantity");

    if (!trimmedName || !Number.isFinite(parsedPrice) || parsedPrice < 0) {
      return res.status(400).json({ message: "valid name and non-negative price are required" });
    }

    if (parsedDefaultQuantity.error) {
      return res.status(400).json({ message: parsedDefaultQuantity.error });
    }

    if (parsedCurrentQuantity.error) {
      return res.status(400).json({ message: parsedCurrentQuantity.error });
    }

    const nextDefaultQuantity = parsedDefaultQuantity.value;
    const nextCurrentQuantity = parsedCurrentQuantity.value ?? nextDefaultQuantity;
    if (nextCurrentQuantity > nextDefaultQuantity) {
      return res.status(400).json({ message: "currentQuantity cannot exceed defaultQuantity" });
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
      imageUrl: imageUrl ? String(imageUrl).trim() : null,
      price: parsedPrice,
      isAvailable: typeof isAvailable === "boolean" ? isAvailable : true,
      defaultQuantity: nextDefaultQuantity,
      currentQuantity: nextCurrentQuantity,
      quantityResetDate: Food.getStockDate(),
    });

    return res.status(201).json({ message: "Created", data: normalizeFood(newFood) });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.updateFood = async (req, res) => {
  try {
    await Food.resetExpiredDailyQuantities();

    const id = Number(req.params.id);
    const { name, price, categoryId, imageUrl, isAvailable, defaultQuantity, currentQuantity } = req.body;
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

    let nextDefaultQuantity = Number(item.defaultQuantity || 0);
    if (defaultQuantity !== undefined) {
      const parsedDefaultQuantity = parseOptionalNonNegativeInteger(defaultQuantity, "defaultQuantity");
      if (parsedDefaultQuantity.error) {
        return res.status(400).json({ message: parsedDefaultQuantity.error });
      }
      nextDefaultQuantity = parsedDefaultQuantity.value;
    }

    let nextCurrentQuantity = Number(item.currentQuantity || 0);
    if (currentQuantity !== undefined) {
      const parsedCurrentQuantity = parseOptionalNonNegativeInteger(currentQuantity, "currentQuantity");
      if (parsedCurrentQuantity.error) {
        return res.status(400).json({ message: parsedCurrentQuantity.error });
      }
      nextCurrentQuantity = parsedCurrentQuantity.value;
    } else if (defaultQuantity !== undefined) {
      nextCurrentQuantity = Math.min(nextCurrentQuantity, nextDefaultQuantity);
    }

    if (nextCurrentQuantity > nextDefaultQuantity) {
      return res.status(400).json({ message: "currentQuantity cannot exceed defaultQuantity" });
    }

    const nextImageUrl =
      imageUrl !== undefined ? (imageUrl ? String(imageUrl).trim() : null) : item.imageUrl;

    await item.update({
      name: trimmedName,
      imageUrl: nextImageUrl,
      price: parsedPrice,
      categoryId: nextCategoryId,
      isAvailable: typeof isAvailable === "boolean" ? isAvailable : item.isAvailable,
      defaultQuantity: nextDefaultQuantity,
      currentQuantity: nextCurrentQuantity,
      quantityResetDate: item.quantityResetDate || Food.getStockDate(),
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
