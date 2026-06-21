const { Topping, FoodTopping, Restaurant, Food } = require("../models");
const { resolveUserRoles } = require("../utils/roleResolver");

const withError = (res, status, msg) => res.status(status).json({ message: msg, error: { message: msg } });
const withSuccess = (res, status, msg, data) => res.status(status).json({ message: msg, success: { message: msg, data }, data });

const getLocalDateOnly = () => {
  const now = new Date();
  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localDate.toISOString().slice(0, 10);
};

exports.listByRestaurant = async (req, res) => {
  try {
    await Topping.resetExpiredDailyQuantities();
    const restaurantId = Number(req.params.id);
    const toppings = await Topping.findAll({ where: { restaurantId } });
    return withSuccess(res, 200, "Toppings fetched", toppings);
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.createTopping = async (req, res) => {
  try {
    const restaurantId = Number(req.params.id);
    const { name, price, isAvailable = true, defaultQuantity = 0, currentQuantity = 0, endDate, startDate } = req.body;

    const restaurant = await Restaurant.findByPk(restaurantId);
    if (!restaurant) return withError(res, 404, "Restaurant not found");

    const { hasRole } = await resolveUserRoles(req);
    const isAdmin = hasRole(["ADMIN"]);
    if (!isAdmin && Number(restaurant.ownerId) !== Number(req.user?.id)) {
      return withError(res, 403, "Not allowed to add topping to this restaurant");
    }

    if (!name) return withError(res, 400, "name is required");

    const todayStr = getLocalDateOnly();
    if (startDate && startDate < todayStr) {
      return withError(res, 400, "Ngày bắt đầu không được ở trong quá khứ");
    }
    if (endDate && endDate < todayStr) {
      return withError(res, 400, "Ngày kết thúc không được ở trong quá khứ");
    }
    if (startDate && endDate && startDate > endDate) {
      return withError(res, 400, "Ngày kết thúc phải sau ngày bắt đầu");
    }

    const topping = await Topping.create({
      restaurantId,
      name: String(name).trim(),
      price: Number(price) || 0,
      isAvailable: Boolean(isAvailable),
      defaultQuantity: Number(defaultQuantity) || 0,
      currentQuantity: Number(currentQuantity) || 0,
      startDate: startDate || null,
      endDate: endDate || null,
    });

    return withSuccess(res, 201, "Topping created", topping);
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.updateTopping = async (req, res) => {
  try {
    const toppingId = Number(req.params.id);
    const { name, price, isAvailable, defaultQuantity, currentQuantity, endDate, startDate } = req.body;

    const topping = await Topping.findByPk(toppingId, { include: ["restaurant"] });
    if (!topping) return withError(res, 404, "Topping not found");

    const { hasRole } = await resolveUserRoles(req);
    const isAdmin = hasRole(["ADMIN"]);
    if (!isAdmin && Number(topping.restaurant.ownerId) !== Number(req.user?.id)) {
      return withError(res, 403, "Not allowed to update this topping");
    }

    const todayStr = getLocalDateOnly();
    if (startDate !== undefined && startDate !== null && startDate !== topping.startDate && startDate < todayStr) {
      return withError(res, 400, "Ngày bắt đầu không được ở trong quá khứ");
    }
    if (endDate !== undefined && endDate !== null && endDate !== topping.endDate && endDate < todayStr) {
      return withError(res, 400, "Ngày kết thúc không được ở trong quá khứ");
    }
    
    const finalStartDate = startDate !== undefined ? startDate : topping.startDate;
    const finalEndDate = endDate !== undefined ? endDate : topping.endDate;
    if (finalStartDate && finalEndDate && finalStartDate > finalEndDate) {
      return withError(res, 400, "Ngày kết thúc phải sau ngày bắt đầu");
    }

    const updates = {};
    if (name !== undefined) updates.name = String(name).trim();
    if (price !== undefined) updates.price = Number(price);
    if (isAvailable !== undefined) updates.isAvailable = Boolean(isAvailable);
    if (defaultQuantity !== undefined) updates.defaultQuantity = Number(defaultQuantity);
    if (currentQuantity !== undefined) updates.currentQuantity = Number(currentQuantity);
    if (startDate !== undefined) updates.startDate = startDate || null;
    if (endDate !== undefined) updates.endDate = endDate || null;

    await topping.update(updates);
    return withSuccess(res, 200, "Topping updated", topping);
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.deleteTopping = async (req, res) => {
  try {
    const toppingId = Number(req.params.id);
    const topping = await Topping.findByPk(toppingId, { include: ["restaurant"] });
    if (!topping) return withError(res, 404, "Topping not found");

    const { hasRole } = await resolveUserRoles(req);
    const isAdmin = hasRole(["ADMIN"]);
    if (!isAdmin && Number(topping.restaurant.ownerId) !== Number(req.user?.id)) {
      return withError(res, 403, "Not allowed to delete this topping");
    }

    await topping.destroy();
    return withSuccess(res, 200, "Topping deleted", null);
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.listByFood = async (req, res) => {
  try {
    const foodId = Number(req.params.id);
    const food = await Food.findByPk(foodId, {
      include: [{ model: Topping, as: "toppings", through: { attributes: [] } }]
    });

    if (!food) return withError(res, 404, "Food not found");

    return withSuccess(res, 200, "Food toppings fetched", food.toppings);
  } catch (error) {
    return withError(res, 500, error.message);
  }
};

exports.assignToFood = async (req, res) => {
  try {
    const foodId = Number(req.params.id);
    const { toppingIds } = req.body; // array of topping ids

    if (!Array.isArray(toppingIds)) {
      return withError(res, 400, "toppingIds must be an array");
    }

    const food = await Food.findByPk(foodId, { include: ["category"] });
    if (!food) return withError(res, 404, "Food not found");

    const restaurantId = food.category.restaurantId;
    const restaurant = await Restaurant.findByPk(restaurantId);

    const { hasRole } = await resolveUserRoles(req);
    const isAdmin = hasRole(["ADMIN"]);
    if (!isAdmin && Number(restaurant.ownerId) !== Number(req.user?.id)) {
      return withError(res, 403, "Not allowed to assign toppings for this food");
    }

    // Verify all toppings belong to the restaurant
    const toppings = await Topping.findAll({ where: { id: toppingIds } });
    for (const t of toppings) {
      if (t.restaurantId !== restaurantId) {
        return withError(res, 400, `Topping ${t.id} does not belong to this restaurant`);
      }
    }

    // Replace current toppings
    await food.setToppings(toppingIds);

    const updatedFood = await Food.findByPk(foodId, {
      include: [{ model: Topping, as: "toppings", through: { attributes: [] } }]
    });

    return withSuccess(res, 200, "Toppings assigned to food", updatedFood.toppings);
  } catch (error) {
    return withError(res, 500, error.message);
  }
};
