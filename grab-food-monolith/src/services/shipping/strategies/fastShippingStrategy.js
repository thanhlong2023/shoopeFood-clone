const FAST_PER_KM_FEE = 5000;
const FAST_FLAT_FEE = 8000;

class FastShippingStrategy {
  constructor() {
    this.code = "FAST";
  }

  calculate(distanceKm) {
    const validDistance = Number.isFinite(Number(distanceKm)) ? Number(distanceKm) : 0;
    return FAST_FLAT_FEE + validDistance * FAST_PER_KM_FEE;
  }
}

module.exports = FastShippingStrategy;
