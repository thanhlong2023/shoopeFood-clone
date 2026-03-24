const express = require("express");
const restaurantController = require("../controllers/restaurantController");

const router = express.Router();

router.get("/", restaurantController.listRestaurants);
router.get("/:id", restaurantController.getRestaurantById);
router.post("/", restaurantController.createRestaurant);
router.put("/:id", restaurantController.updateRestaurant);
router.delete("/:id", restaurantController.deleteRestaurant);

module.exports = router;
