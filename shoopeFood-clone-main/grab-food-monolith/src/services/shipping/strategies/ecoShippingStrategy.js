const ECO_PER_KM_FEE = 2800;

class EcoShippingStrategy {
  constructor() {
    this.code = "ECO";
  }

  calculate(distanceKm) {
    const validDistance = Number.isFinite(Number(distanceKm)) ? Number(distanceKm) : 0;
    return validDistance * ECO_PER_KM_FEE;
  }
}

module.exports = EcoShippingStrategy;
