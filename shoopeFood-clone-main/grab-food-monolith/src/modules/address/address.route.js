const express = require("express");
const addressController = require("./address.controller");

const router = express.Router();

router.get("/suggest", addressController.suggest);
router.get("/detail/:placeId", addressController.detail);

module.exports = router;
