const express = require("express");
const restaurantController = require("../controllers/restaurantController");

const router = express.Router();

router.get("/mine", restaurantController.listMyRestaurants);
router.get("/admin/pending", restaurantController.listPendingRestaurants);
router.get("/admin/change-requests", restaurantController.listChangeRequests);
router.patch("/admin/change-requests/:id/approve", restaurantController.approveChangeRequest);
router.patch("/admin/change-requests/:id/reject", restaurantController.rejectChangeRequest);
router.patch("/admin/:id/approve", restaurantController.approveRestaurant);
router.patch("/admin/:id/reject", restaurantController.rejectRestaurant);
router.get("/", restaurantController.listRestaurants);
router.get("/:id", restaurantController.getRestaurantById);
router.post("/", restaurantController.createRestaurant);
router.put("/:id", restaurantController.updateRestaurant);
router.delete("/:id", restaurantController.deleteRestaurant);
router.patch("/:id/status", restaurantController.patchRestaurantStatus);
router.patch("/:id/today-status", restaurantController.patchRestaurantTodayStatus);
router.patch("/:id/location", restaurantController.patchRestaurantLocation);

module.exports = router;
