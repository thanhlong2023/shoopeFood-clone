const DRIVER_ACTIVE_STATUS_CODES = ["DRIVER_ACCEPTED", "PICKING_UP", "DELIVERING"];
const DRIVER_AVAILABLE_STATUS_CODE = "CONFIRMED";
const TERMINAL_STATUS_CODES = ["COMPLETED", "CANCELLED", "TIMEOUT"];

const TRANSITIONS_BY_ROLE = {
  MERCHANT: {
    PENDING: ["CONFIRMED", "CANCELLED"],
    CONFIRMED: ["CANCELLED"],
  },
  DRIVER: {
    DRIVER_ACCEPTED: ["PICKING_UP"],
    PICKING_UP: ["DELIVERING"],
    DELIVERING: ["COMPLETED"],
  },
  CUSTOMER: {
    PENDING: ["CANCELLED"],
    CONFIRMED: ["CANCELLED"],
  },
};

const isTerminalStatus = (statusCode) => TERMINAL_STATUS_CODES.includes(statusCode);

const isDriverActiveStatus = (statusCode) => DRIVER_ACTIVE_STATUS_CODES.includes(statusCode);

const getAllowedTransitions = (role, fromStatusCode) => {
  if (role === "ADMIN") {
    return null;
  }

  return TRANSITIONS_BY_ROLE[role]?.[fromStatusCode] || [];
};

const validateTransition = ({ role, fromStatusCode, toStatusCode, order }) => {
  if (!fromStatusCode || !toStatusCode) {
    return { ok: false, statusCode: 400, message: "Order status is not configured" };
  }

  if (fromStatusCode === toStatusCode) {
    return { ok: true };
  }

  if (isTerminalStatus(fromStatusCode)) {
    return {
      ok: false,
      statusCode: 409,
      message: `Cannot update a terminal ${fromStatusCode} order`,
    };
  }

  if (role === "ADMIN") {
    return { ok: true };
  }

  const allowed = getAllowedTransitions(role, fromStatusCode);
  if (!allowed.includes(toStatusCode)) {
    return {
      ok: false,
      statusCode: 409,
      message: `${role} cannot change order from ${fromStatusCode} to ${toStatusCode}`,
    };
  }

  if (role === "CUSTOMER" && toStatusCode === "CANCELLED" && order?.driverId) {
    return {
      ok: false,
      statusCode: 400,
      message: "Cannot cancel an order after a driver has accepted it",
    };
  }

  if (role === "MERCHANT" && toStatusCode === "CANCELLED" && isDriverActiveStatus(fromStatusCode)) {
    return {
      ok: false,
      statusCode: 400,
      message: "Cannot cancel an order after pickup has started",
    };
  }

  return { ok: true };
};

module.exports = {
  DRIVER_ACTIVE_STATUS_CODES,
  DRIVER_AVAILABLE_STATUS_CODE,
  TERMINAL_STATUS_CODES,
  getAllowedTransitions,
  isDriverActiveStatus,
  isTerminalStatus,
  validateTransition,
};
