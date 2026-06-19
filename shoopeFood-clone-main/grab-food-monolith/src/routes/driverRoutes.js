const express = require("express");
const driverController = require("../controllers/driverController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");

const router = express.Router();

router.get("/me/orders", auth, requireRole(["DRIVER"]), driverController.getMyOrderFeed);
router.get("/me/route", auth, requireRole(["DRIVER"]), driverController.getDrivingRoute);
router.get("/me/completed", auth, requireRole(["DRIVER"]), driverController.getMyCompletedOrders);
router.get("/", auth, requireRole(["ADMIN", "DRIVER"]), driverController.getDrivers);
router.get("/:id/info", auth, driverController.getDriverInfo);
router.get("/:id/profile", auth, driverController.getDriverProfile);
router.get("/:id/location", auth, driverController.getLatestDriverLocation);
router.get("/:id", auth, requireRole(["ADMIN", "DRIVER"]), driverController.getDriverById);
router.post("/", auth, requireRole(["ADMIN"]), driverController.createDriver);
router.post("/:id/location", auth, driverController.updateDriverLocation);
router.put("/:id/online", auth, driverController.updateDriverOnlineStatus);
router.put("/:id/online/on", auth, driverController.setDriverOnline);
router.put("/:id/online/off", auth, driverController.setDriverOffline);
router.put("/:id", auth, requireRole(["ADMIN"]), driverController.updateDriver);
router.delete("/:id", auth, requireRole(["ADMIN"]), driverController.deleteDriver);

module.exports = router;
