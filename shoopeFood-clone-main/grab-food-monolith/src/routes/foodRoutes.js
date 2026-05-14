const express = require("express");
<<<<<<< HEAD
const auth = require("../middleware/auth");
const role = require("../middleware/role");
=======
>>>>>>> origin/main
const foodController = require("../controllers/foodController");

const router = express.Router();

router.get("/", foodController.getAllFoods);
router.get("/:id", foodController.getFoodById);
<<<<<<< HEAD
router.post("/", auth, role(["ADMIN", "MERCHANT"]), foodController.createFood);
router.put("/:id", auth, role(["ADMIN", "MERCHANT"]), foodController.updateFood);
router.delete("/:id", auth, role(["ADMIN", "MERCHANT"]), foodController.deleteFood);
=======
router.post("/", foodController.createFood);
router.put("/:id", foodController.updateFood);
router.delete("/:id", foodController.deleteFood);
>>>>>>> origin/main

module.exports = router;
