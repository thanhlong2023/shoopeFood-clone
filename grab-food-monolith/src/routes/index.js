const express = require("express");
const userRoutes = require("./userRoutes");
const driverRoutes = require("./driverRoutes");
const orderRoutes = require("./orderRoutes");
const restaurantRoutes = require("./restaurantRoutes");
const categoryRoutes = require("./categoryRoutes");
const foodRoutes = require("./foodRoutes");

const router = express.Router();

router.get("/", (req, res) => {
  res.render("home", { title: "GrabFood Monolith" });
});

router.get("/map", (req, res) => {
  res.render("map");
});

router.get("/foods-crud", (req, res) => {
  res.render("foods-crud");
});

router.get("/categories-crud", (req, res) => {
  res.render("categories-crud");
});

router.use("/api/users", userRoutes);
router.use("/api/drivers", driverRoutes);
router.use("/api/orders", orderRoutes);
router.use("/api/restaurants", restaurantRoutes);
router.use("/api/categories", categoryRoutes);
router.use("/api/foods", foodRoutes);

module.exports = router;
