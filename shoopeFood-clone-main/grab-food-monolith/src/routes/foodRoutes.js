const express = require("express");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const foodController = require("../controllers/foodController");

const router = express.Router();

router.get("/", foodController.getAllFoods);
router.get("/:id", foodController.getFoodById);
router.post("/", auth, role(["ADMIN", "MERCHANT"]), foodController.createFood);
router.put("/:id", auth, role(["ADMIN", "MERCHANT"]), foodController.updateFood);
router.delete("/:id", auth, role(["ADMIN", "MERCHANT"]), foodController.deleteFood);

module.exports = router;
