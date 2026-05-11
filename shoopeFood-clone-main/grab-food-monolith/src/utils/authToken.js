const crypto = require("crypto");

const TOKEN_TTL_SECONDS = 60 * 60 * 24;

const getSecret = () => process.env.AUTH_TOKEN_SECRET || process.env.JWT_SECRET || "grabfood-dev-secret";

const toBase64Url = (value) => Buffer.from(value).toString("base64url");

const sign = (payload) =>
  crypto.createHmac("sha256", getSecret()).update(payload).digest("base64url");

const createAuthToken = (payload, ttlSeconds = TOKEN_TTL_SECONDS) => {
  const now = Math.floor(Date.now() / 1000);
  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + ttlSeconds,
  };
  const encodedPayload = toBase64Url(JSON.stringify(tokenPayload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
};

const verifyAuthToken = (token) => {
  if (!token || !token.includes(".")) {
    throw new Error("Invalid token");
  }

  const [encodedPayload, signature] = token.split(".");
  const expectedSignature = sign(encodedPayload);

  const isValidSignature =
    signature.length === expectedSignature.length &&
    crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));

  if (!isValidSignature) {
    throw new Error("Invalid token");
  }

  const payload = JSON.parse(Buffer.from(encodedPayload, "base64url").toString("utf8"));
  const now = Math.floor(Date.now() / 1000);

  if (payload.exp && payload.exp < now) {
    throw new Error("Token expired");
  }

  return payload;
};

module.exports = {
  createAuthToken,
  verifyAuthToken,
};
