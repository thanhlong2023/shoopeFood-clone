const STANDARD_PER_KM_FEE = 3500;

class StandardShippingStrategy {
  constructor() {
    this.code = "STANDARD";
  }

  calculate(distanceKm) {
    const validDistance = Number.isFinite(Number(distanceKm)) ? Number(distanceKm) : 0;
    return validDistance * STANDARD_PER_KM_FEE;
  }
}

module.exports = StandardShippingStrategy;
