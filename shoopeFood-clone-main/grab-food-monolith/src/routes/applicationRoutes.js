const express = require("express");
const applicationController = require("../controllers/applicationController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");

const router = express.Router();

router.get("/my-status", auth, applicationController.getMyApplicationStatus);
router.post("/driver", auth, applicationController.applyDriver);
router.post("/merchant", auth, applicationController.applyMerchant);

router.get("/drivers/pending", auth, requireRole(["ADMIN"]), applicationController.listPendingDrivers);
router.patch("/drivers/:userId/approve", auth, requireRole(["ADMIN"]), applicationController.approveDriver);
router.patch("/drivers/:userId/reject", auth, requireRole(["ADMIN"]), applicationController.rejectDriver);

module.exports = router;
