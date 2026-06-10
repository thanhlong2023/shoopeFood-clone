const { Payment, PaymentTransaction, Order } = require("../models");

const ALLOWED_PAYMENT_METHODS = new Set(["CASH", "E_WALLET", "CREDIT_CARD"]);

// Tiện ích sleep giả lập timeout cổng thanh toán
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

exports.createPayment = async (req, res) => {
  try {
    const { orderId, idempotencyKey, paymentMethod } = req.body;

    if (!orderId || !idempotencyKey || !paymentMethod) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const normalizedMethod = String(paymentMethod).trim().toUpperCase();
    if (!ALLOWED_PAYMENT_METHODS.has(normalizedMethod)) {
      return res.status(400).json({
        message: "Invalid paymentMethod. Allowed: CASH, E_WALLET, CREDIT_CARD",
      });
    }

    const order = await Order.findByPk(orderId);
    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    // Kiểm tra xem Payment cho order này đã tồn tại chưa
    let payment = await Payment.findOne({ where: { orderId } });
    if (!payment) {
      payment = await Payment.create({
        orderId,
        idempotencyKey,
        paymentMethod: normalizedMethod,
        amount: order.totalAmount,
        status: "PENDING"
      });
    }

    return res.status(201).json({ message: "Payment checkout created", data: payment });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.processPaymentCallback = async (req, res) => {
  try {
    const { paymentId, gatewayRef } = req.body;

    const payment = await Payment.findByPk(paymentId);
    if (!payment) {
      return res.status(404).json({ message: "Payment not found" });
    }

    // Lấy số transaction tiếp theo
    const attemptCount = await PaymentTransaction.count({ where: { paymentId } });
    
    // Giả lập processing delay 1-2s
    await sleep(Math.floor(Math.random() * 1000) + 1000);

    // Xác suất 5% thất bại mock theo yêu cầu
    const isMockFailure = Math.random() < 0.05;
    const nextStatus = isMockFailure ? (Math.random() < 0.5 ? "FAILED" : "TIMEOUT") : "SUCCESS";
    
    // Ghi transaction
    const transaction = await PaymentTransaction.create({
      paymentId,
      attemptNumber: attemptCount + 1,
      status: nextStatus === "TIMEOUT" ? "FAILED" : nextStatus,
      transactionRef: gatewayRef || `MOCK-${Date.now()}`,
      gatewayResponse: isMockFailure ? { code: "99", message: "Giao dịch lỗi/Timeout" } : { code: "00", message: "Thành công" },
    });

    if (nextStatus === "SUCCESS") {
      await payment.update({ status: "SUCCESS" });
    } else {
      await payment.update({ status: "FAILED" });
    }

    return res.json({ 
      message: "Callback processed", 
      data: {
        payment,
        transaction
      }
    });

  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.getPaymentStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const payment = await Payment.findOne({
      where: { orderId },
      include: [{ model: PaymentTransaction, as: "transactions" }]
    });

    if (!payment) {
      return res.status(404).json({ message: "Payment not found for this order" });
    }

    return res.json({ data: payment });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
