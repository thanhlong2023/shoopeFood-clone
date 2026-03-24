exports.calculateShippingFee = (distanceKm, baseFee) => {
  const validDistance = Number.isFinite(distanceKm) ? distanceKm : 0;
  const perKmFee = 3500;

  return validDistance * perKmFee;
};
