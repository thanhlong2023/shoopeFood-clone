const StandardShippingStrategy = require("./strategies/standardShippingStrategy");
const FastShippingStrategy = require("./strategies/fastShippingStrategy");
const EcoShippingStrategy = require("./strategies/ecoShippingStrategy");

class ShippingStrategyFactory {
  constructor() {
    this.registry = new Map();

    [new StandardShippingStrategy(), new FastShippingStrategy(), new EcoShippingStrategy()].forEach((strategy) => {
      this.registry.set(strategy.code, strategy);
    });
  }

  resolve(strategyCode) {
    const normalizedCode = String(strategyCode || "STANDARD").trim().toUpperCase();
    return this.registry.get(normalizedCode) || this.registry.get("STANDARD");
  }

  listCodes() {
    return Array.from(this.registry.keys());
  }
}

module.exports = new ShippingStrategyFactory();
