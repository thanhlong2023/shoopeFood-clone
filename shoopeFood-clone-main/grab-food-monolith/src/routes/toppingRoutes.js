const express = require("express");
const router = express.Router();
const toppingController = require("../controllers/ToppingController");
const authMiddleware = require("../middleware/auth");

// Restaurant toppings
router.get("/restaurants/:id/toppings", toppingController.listByRestaurant);
router.post("/restaurants/:id/toppings", authMiddleware, toppingController.createTopping);

// Topping management
router.put("/toppings/:id", authMiddleware, toppingController.updateTopping);
router.delete("/toppings/:id", authMiddleware, toppingController.deleteTopping);

// Food toppings
router.get("/foods/:id/toppings", toppingController.listByFood);
router.post("/foods/:id/toppings", authMiddleware, toppingController.assignToFood);

module.exports = router;
