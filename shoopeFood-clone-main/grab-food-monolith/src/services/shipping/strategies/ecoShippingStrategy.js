class EcoShippingStrategy {
  constructor() {
    this.code = "ECO";
  }

  calculate(distanceKm) {
    const validDistance = Number.isFinite(Number(distanceKm)) ? Number(distanceKm) : 0;
    const roundedDistance = Math.ceil(validDistance * 10) / 10;
    const standardFee = roundedDistance <= 2 ? 16000 : 16000 + (roundedDistance - 2) * 5000;
    return Math.max(12000, standardFee - 4000);
  }
}

module.exports = EcoShippingStrategy;
