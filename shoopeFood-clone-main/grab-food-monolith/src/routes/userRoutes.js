const express = require("express");
const userController = require("../controllers/userController");
const auth = require("../middleware/auth");
const requireRole = require("../middleware/role");

const router = express.Router();

router.get("/me", auth, userController.getProfile);
router.get("/merchants", auth, requireRole(["ADMIN"]), userController.listMerchants);
router.post("/merchants", auth, requireRole(["ADMIN"]), userController.createMerchant);
router.get("/", userController.getUsers);
router.get("/:id", userController.getUserById);
router.post("/", userController.createUser);
router.put("/:id", userController.updateUser);
router.delete("/:id", userController.deleteUser);

module.exports = router;
