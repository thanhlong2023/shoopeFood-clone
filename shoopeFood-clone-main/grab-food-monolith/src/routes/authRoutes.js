const express = require("express");
const authController = require("../controllers/authController");
const auth = require("../middleware/auth");

const router = express.Router();

router.post("/login", authController.login);
router.post("/register", authController.register);
router.get("/me", auth, authController.me);
router.put("/profile", auth, authController.updateProfile);
router.put("/password", auth, authController.changePassword);
router.post("/activate-role", auth, authController.activateRole);
router.post("/forgot-password", authController.forgotPassword);
router.post("/reset-password", authController.resetPassword);
module.exports = router;
