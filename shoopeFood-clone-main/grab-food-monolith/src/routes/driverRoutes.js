const express = require("express");
const driverController = require("../controllers/driverController");

const router = express.Router();

router.get("/", driverController.getDrivers);
router.get("/:id/info", driverController.getDriverInfo);
router.get("/:id/location", driverController.getLatestDriverLocation);
router.get("/:id", driverController.getDriverById);
router.post("/", driverController.createDriver);
router.post("/:id/location", driverController.updateDriverLocation);
router.put("/:id/online", driverController.updateDriverOnlineStatus);
router.put("/:id/online/on", driverController.setDriverOnline);
router.put("/:id/online/off", driverController.setDriverOffline);
router.put("/:id", driverController.updateDriver);
router.delete("/:id", driverController.deleteDriver);

module.exports = router;
