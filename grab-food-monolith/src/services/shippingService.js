const shippingStrategyFactory = require("./shipping/shippingStrategyFactory");

exports.calculateShippingFee = (distanceKm, baseFee, shippingType = "STANDARD") => {
  const strategy = shippingStrategyFactory.resolve(shippingType);
  return strategy.calculate(distanceKm, baseFee);
};

exports.getSupportedShippingTypes = () => shippingStrategyFactory.listCodes();
