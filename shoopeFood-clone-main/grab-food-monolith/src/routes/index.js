const express = require("express");
const authRoutes = require("./authRoutes");
const userRoutes = require("./userRoutes");
const driverRoutes = require("./driverRoutes");
const orderRoutes = require("./orderRoutes");
const restaurantRoutes = require("./restaurantRoutes");
const categoryRoutes = require("./categoryRoutes");
const foodRoutes = require("./foodRoutes");
const paymentRoutes = require("./paymentRoutes");
const applicationRoutes = require("./applicationRoutes");
const reviewRoutes = require("./reviewRoutes");
const addressRoutes = require("../modules/address/address.route");
const toppingRoutes = require("./toppingRoutes");


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

router.get("/orders-dashboard", (req, res) => {
  res.render("orders-dashboard", { title: "Orders Dashboard" });
});

router.use("/api/auth", authRoutes);
router.use("/api/users", userRoutes);
router.use("/api/drivers", driverRoutes);
router.use("/api/orders", orderRoutes);
router.use("/api/restaurants", restaurantRoutes);
router.use("/api/categories", categoryRoutes);
router.use("/api/foods", foodRoutes);
router.use("/api/payments", paymentRoutes);
router.use("/api/applications", applicationRoutes);
router.use("/api/reviews", reviewRoutes);
router.use("/api/addresses", addressRoutes);
router.use("/api", toppingRoutes); // toppingRoutes handles /restaurants/:id/toppings, /toppings/:id, /foods/:id/toppings


module.exports = router;
