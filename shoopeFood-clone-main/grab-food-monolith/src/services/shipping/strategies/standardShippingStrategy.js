class StandardShippingStrategy {
  constructor() {
    this.code = "STANDARD";
  }

  calculate(distanceKm) {
    const validDistance = Number.isFinite(Number(distanceKm)) ? Number(distanceKm) : 0;
    const roundedDistance = Math.ceil(validDistance * 10) / 10;
    if (roundedDistance <= 2) {
      return 16000;
    }
    return 16000 + (roundedDistance - 2) * 5000;
  }
}

module.exports = StandardShippingStrategy;
