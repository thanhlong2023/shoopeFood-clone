const express = require("express");
const orderController = require("../controllers/orderController");
const auth = require("../middleware/auth");
const optionalAuth = require("../middleware/optionalAuth");
const requireRole = require("../middleware/role");

const router = express.Router();

router.post("/secure", auth, requireRole(["CUSTOMER"]), orderController.createOrder);
router.get("/", auth, orderController.getOrders);
router.get("/page", orderController.getOrdersPage);
router.get("/route", auth, orderController.getRoute);
router.get("/:id/tracking", optionalAuth, orderController.getOrderTracking);
router.get("/:id", orderController.getOrderById);
router.post("/:id/accept", auth, requireRole(["DRIVER"]), orderController.acceptOrder);
router.post("/:id/cancel", auth, requireRole(["CUSTOMER"]), orderController.cancelOrder);
router.post("/", auth, requireRole(["CUSTOMER"]), orderController.createOrder);
router.patch("/:id/reject", auth, requireRole(["MERCHANT"]), orderController.rejectOrder);
router.put("/:id/status", auth, orderController.updateOrderStatus);
router.put("/:id", auth, requireRole(["ADMIN"]), orderController.updateOrder);
router.delete("/:id", auth, requireRole(["ADMIN"]), orderController.deleteOrder);

module.exports = router;
