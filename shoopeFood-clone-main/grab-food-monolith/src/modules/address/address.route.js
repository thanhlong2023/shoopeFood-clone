const express = require("express");
const addressController = require("./address.controller");

const router = express.Router();

router.get("/suggest", addressController.suggest);
router.get("/detail/:placeId", addressController.detail);
router.get("/reverse", addressController.reverse);

module.exports = router;
