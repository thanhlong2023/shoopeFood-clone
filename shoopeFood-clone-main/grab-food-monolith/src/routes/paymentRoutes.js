const express = require("express");
const paymentController = require("../controllers/paymentController");

const router = express.Router();

router.post("/create", paymentController.createPayment);
router.post("/callback", paymentController.processPaymentCallback);
router.get("/:orderId", paymentController.getPaymentStatus);

module.exports = router;
