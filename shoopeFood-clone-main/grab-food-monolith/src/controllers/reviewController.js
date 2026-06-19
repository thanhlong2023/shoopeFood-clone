const { fn, col } = require("sequelize");
const { Order, OrderStatus, Review, User, Restaurant } = require("../models");

const normalizeReview = (review) => ({
  id: Number(review.id),
  orderId: Number(review.orderId),
  customerId: Number(review.customerId),
  targetType: review.targetType,
  targetId: Number(review.targetId),
  rating: Number(review.rating),
  comment: review.comment || "",
  createdAt: review.createdAt,
});

exports.getRestaurantReviewSummary = async (_req, res) => {
  try {
    const rows = await Review.findAll({
      attributes: [
        "targetId",
        [fn("COUNT", col("id")), "reviewCount"],
        [fn("AVG", col("rating")), "ratingAvg"],
      ],
      where: { targetType: "RESTAURANT" },
      group: ["targetId"],
      raw: true,
    });

    return res.json({
      data: rows.map((row) => ({
        restaurantId: Number(row.targetId),
        reviewCount: Number(row.reviewCount || 0),
        ratingAvg: Number(Number(row.ratingAvg || 0).toFixed(2)),
      })),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};

exports.createReview = async (req, res) => {
  try {
    const orderId = Number(req.body.orderId);
    const targetType = String(req.body.targetType || "RESTAURANT").toUpperCase();
    const rating = Number(req.body.rating);
    const comment = String(req.body.comment || "").trim();

    if (!Number.isInteger(orderId) || orderId <= 0) {
      return res.status(400).json({ message: "orderId is required" });
    }

    if (!["RESTAURANT", "DRIVER"].includes(targetType)) {
      return res.status(400).json({ message: "targetType must be RESTAURANT or DRIVER" });
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ message: "rating must be from 1 to 5" });
    }

    const order = await Order.findByPk(orderId, {
      include: [{ model: OrderStatus, as: "statusInfo", attributes: ["code"] }],
    });

    if (!order) {
      return res.status(404).json({ message: "Order not found" });
    }

    if (Number(order.customerId) !== Number(req.user?.id)) {
      return res.status(403).json({ message: "You can only review your own orders" });
    }

    if (order.statusInfo?.code !== "COMPLETED") {
      return res.status(400).json({ message: "Only completed orders can be reviewed" });
    }

    const targetId = targetType === "RESTAURANT" ? Number(order.restaurantId) : Number(order.driverId);
    if (!targetId) {
      return res.status(400).json({ message: "Review target is not available for this order" });
    }

    const [review, created] = await Review.findOrCreate({
      where: { orderId: order.id, targetType },
      defaults: {
        orderId: order.id,
        customerId: req.user.id,
        targetType,
        targetId,
        rating,
        comment,
      },
    });

    if (!created) {
      await review.update({ rating, comment, targetId });
    }

    const avgResult = await Review.findOne({
      where: { targetType, targetId },
      attributes: [[fn("AVG", col("rating")), "ratingAvg"]],
      raw: true,
    });
    const newRatingAvg = avgResult && avgResult.ratingAvg ? Number(Number(avgResult.ratingAvg).toFixed(2)) : 5.0;

    if (targetType === "DRIVER") {
      await User.update({ ratingAvg: newRatingAvg }, { where: { id: targetId } });
    } else if (targetType === "RESTAURANT") {
      await Restaurant.update({ ratingAvg: newRatingAvg }, { where: { id: targetId } });
    }

    return res.status(created ? 201 : 200).json({
      message: created ? "Review created" : "Review updated",
      data: normalizeReview(review),
    });
  } catch (error) {
    return res.status(500).json({ message: error.message });
  }
};
