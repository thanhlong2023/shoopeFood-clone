const express = require("express");
const orderController = require("../controllers/orderController");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/secure", auth, orderController.createOrder);
router.get("/", orderController.getOrders);
router.get("/page", orderController.getOrdersPage);
router.get("/:id", orderController.getOrderById);
router.post("/", orderController.createOrder);
router.put("/:id/status", orderController.updateOrderStatus);
router.put("/:id", orderController.updateOrder);
router.delete("/:id", orderController.deleteOrder);

module.exports = router;
