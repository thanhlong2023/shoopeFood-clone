const express = require("express");
const reviewController = require("../controllers/reviewController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");

const router = express.Router();

router.get("/restaurants/summary", reviewController.getRestaurantReviewSummary);
router.post("/", auth, requireRole(["CUSTOMER"]), reviewController.createReview);

module.exports = router;
