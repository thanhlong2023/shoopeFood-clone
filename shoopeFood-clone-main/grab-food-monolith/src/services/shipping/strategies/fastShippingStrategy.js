class FastShippingStrategy {
  constructor() {
    this.code = "FAST";
  }

  calculate(distanceKm) {
    const validDistance = Number.isFinite(Number(distanceKm)) ? Number(distanceKm) : 0;
    const roundedDistance = Math.ceil(validDistance * 10) / 10;
    const standardFee = roundedDistance <= 2 ? 16000 : 16000 + (roundedDistance - 2) * 5000;
    return standardFee + 5000;
  }
}

module.exports = FastShippingStrategy;
