/**
 * Comprehensive API endpoint audit script
 * Run: node scripts/audit_api.js
 */
const BASE = process.env.API_BASE || "http://localhost:3000";

const results = { pass: [], fail: [], warn: [] };

function log(type, name, detail) {
  const entry = { name, detail };
  results[type].push(entry);
  const icon = type === "pass" ? "OK" : type === "fail" ? "FAIL" : "WARN";
  console.log(`[${icon}] ${name}${detail ? ` — ${detail}` : ""}`);
}

async function request(method, path, { body, token, expectStatus } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;

  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  let json = null;
  const text = await res.text();
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }

  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`Expected ${expectStatus}, got ${res.status}: ${JSON.stringify(json)}`);
  }

  return { status: res.status, json };
}

async function login(phone, password, role) {
  const { status, json } = await request("POST", "/api/auth/login", {
    body: { phone, password, role },
    expectStatus: 200,
  });
  return json.data.token;
}

async function run() {
  console.log(`\n=== API Audit: ${BASE} ===\n`);

  // Health / connectivity
  try {
    await request("GET", "/api/categories", { expectStatus: 200 });
    log("pass", "Server reachable", "GET /api/categories");
  } catch (e) {
    log("fail", "Server unreachable", e.message);
    printSummary();
    process.exit(1);
  }

  // --- AUTH ---
  try {
    await request("POST", "/api/auth/login", {
      body: { phone: "0900000005", password: "123456", role: "ADMIN" },
      expectStatus: 200,
    });
    log("pass", "POST /api/auth/login (admin)");
  } catch (e) {
    log("fail", "POST /api/auth/login (admin)", e.message);
  }

  try {
    await request("POST", "/api/auth/login", {
      body: { phone: "0900000005", password: "wrong", role: "ADMIN" },
      expectStatus: 401,
    });
    log("pass", "POST /api/auth/login invalid password → 401");
  } catch (e) {
    log("fail", "POST /api/auth/login invalid password", e.message);
  }

  let adminToken, merchantToken, customerToken, driverToken;
  try {
    adminToken = await login("0900000005", "123456", "ADMIN");
    merchantToken = await login("0900000003", "123456", "MERCHANT");
    customerToken = await login("0900000001", "123456", "CUSTOMER");
    driverToken = await login("0900000002", "123456", "DRIVER");
    log("pass", "Login all demo roles");
  } catch (e) {
    log("fail", "Login demo roles", e.message);
  }

  try {
    await request("GET", "/api/auth/me", { token: adminToken, expectStatus: 200 });
    log("pass", "GET /api/auth/me");
  } catch (e) {
    log("fail", "GET /api/auth/me", e.message);
  }

  try {
    await request("GET", "/api/auth/me", { expectStatus: 401 });
    log("pass", "GET /api/auth/me without token → 401");
  } catch (e) {
    log("fail", "GET /api/auth/me no token", e.message);
  }

  try {
    await request("PUT", "/api/auth/profile", {
      token: customerToken,
      body: { fullName: "Customer Demo", phone: "0900000001" },
      expectStatus: 200,
    });
    log("pass", "PUT /api/auth/profile");
  } catch (e) {
    log("fail", "PUT /api/auth/profile", e.message);
  }

  // --- USERS ---
  try {
    const { json } = await request("GET", "/api/users", { expectStatus: 200 });
    log("pass", "GET /api/users", `count=${json.data?.length}`);
  } catch (e) {
    log("fail", "GET /api/users", e.message);
  }

  try {
    await request("GET", "/api/users/1", { expectStatus: 200 });
    log("pass", "GET /api/users/:id");
  } catch (e) {
    log("fail", "GET /api/users/:id", e.message);
  }

  try {
    await request("GET", "/api/users/merchants", { token: adminToken, expectStatus: 200 });
    log("pass", "GET /api/users/merchants (admin)");
  } catch (e) {
    log("fail", "GET /api/users/merchants (admin)", e.message);
  }

  try {
    await request("GET", "/api/users/merchants", { token: merchantToken, expectStatus: 403 });
    log("pass", "GET /api/users/merchants (merchant) → 403");
  } catch (e) {
    log("fail", "GET /api/users/merchants (merchant)", e.message);
  }

  try {
    await request("GET", "/api/users/99999", { expectStatus: 404 });
    log("pass", "GET /api/users/:id not found → 404");
  } catch (e) {
    log("fail", "GET /api/users/:id not found", e.message);
  }

  // Route conflict: GET /api/users/merchants vs GET /api/users/:id
  try {
    const { json } = await request("GET", "/api/users/merchants");
    if (json.data && Array.isArray(json.data)) {
      log("pass", "Route /users/merchants before /:id");
    } else {
      log("warn", "GET /api/users/merchants without auth", `status may leak or wrong handler: ${JSON.stringify(json).slice(0, 80)}`);
    }
  } catch (e) {
    log("warn", "GET /api/users/merchants without auth", e.message);
  }

  // --- RESTAURANTS ---
  try {
    const { json } = await request("GET", "/api/restaurants", { expectStatus: 200 });
    log("pass", "GET /api/restaurants", `approved=${json.data?.length}`);
  } catch (e) {
    log("fail", "GET /api/restaurants", e.message);
  }

  try {
    await request("GET", "/api/restaurants?includePending=true", { expectStatus: 200 });
    log("pass", "GET /api/restaurants?includePending=true");
  } catch (e) {
    log("fail", "GET /api/restaurants includePending", e.message);
  }

  try {
    await request("GET", "/api/restaurants/mine", { token: merchantToken, expectStatus: 200 });
    log("pass", "GET /api/restaurants/mine");
  } catch (e) {
    log("fail", "GET /api/restaurants/mine", e.message);
  }

  try {
    await request("GET", "/api/restaurants/admin/pending", { token: adminToken, expectStatus: 200 });
    log("pass", "GET /api/restaurants/admin/pending");
  } catch (e) {
    log("fail", "GET /api/restaurants/admin/pending", e.message);
  }

  try {
    await request("GET", "/api/restaurants/admin/change-requests", { token: adminToken, expectStatus: 200 });
    log("pass", "GET /api/restaurants/admin/change-requests");
  } catch (e) {
    log("fail", "GET /api/restaurants/admin/change-requests", e.message);
  }

  let restaurantId = 1;
  try {
    const { json } = await request("GET", "/api/restaurants/1", { expectStatus: 200 });
    restaurantId = json.data?.id || 1;
    log("pass", "GET /api/restaurants/:id");
  } catch (e) {
    log("fail", "GET /api/restaurants/:id", e.message);
  }

  try {
    await request("GET", "/api/restaurants/99999", { expectStatus: 404 });
    log("pass", "GET /api/restaurants/:id not found → 404");
  } catch (e) {
    log("fail", "GET /api/restaurants/:id not found", e.message);
  }

  // --- CATEGORIES ---
  try {
    const { json } = await request("GET", "/api/categories", { expectStatus: 200 });
    log("pass", "GET /api/categories", `count=${json.data?.length}`);
  } catch (e) {
    log("fail", "GET /api/categories", e.message);
  }

  try {
    await request("GET", `/api/categories?restaurantId=${restaurantId}`, { expectStatus: 200 });
    log("pass", "GET /api/categories?restaurantId");
  } catch (e) {
    log("fail", "GET /api/categories?restaurantId", e.message);
  }

  try {
    await request("POST", "/api/categories", {
      body: { name: "Invalid", restaurantId: 99999 },
      expectStatus: 400,
    });
    log("pass", "POST /api/categories invalid restaurant → 400");
  } catch (e) {
    log("fail", "POST /api/categories invalid restaurant", e.message);
  }

  let catId;
  try {
    const { json } = await request("POST", "/api/categories", {
      body: { name: `Audit Cat ${Date.now()}`, restaurantId },
      expectStatus: 201,
    });
    catId = json.data?.id;
    log("pass", "POST /api/categories", `id=${catId}`);
  } catch (e) {
    log("fail", "POST /api/categories", e.message);
  }

  // --- FOODS ---
  try {
    await request("GET", "/api/foods", { expectStatus: 200 });
    log("pass", "GET /api/foods");
  } catch (e) {
    log("fail", "GET /api/foods", e.message);
  }

  try {
    await request("GET", `/api/foods?restaurantId=${restaurantId}`, { expectStatus: 200 });
    log("pass", "GET /api/foods?restaurantId");
  } catch (e) {
    log("fail", "GET /api/foods?restaurantId", e.message);
  }

  try {
    await request("POST", "/api/foods", {
      body: { name: "   ", price: 10000, categoryId: catId },
      expectStatus: 400,
    });
    log("pass", "POST /api/foods empty name → 400");
  } catch (e) {
    log("fail", "POST /api/foods empty name", e.message);
  }

  let foodId;
  try {
    const { json } = await request("POST", "/api/foods", {
      body: { name: `Audit Food ${Date.now()}`, price: 25000, categoryId: catId },
      expectStatus: 201,
    });
    foodId = json.data?.id;
    log("pass", "POST /api/foods", `id=${foodId}`);
  } catch (e) {
    log("fail", "POST /api/foods", e.message);
  }

  if (catId && foodId) {
    try {
      await request("DELETE", `/api/categories/${catId}`, { expectStatus: 409 });
      log("pass", "DELETE /api/categories with foods → 409");
    } catch (e) {
      log("fail", "DELETE /api/categories with foods", e.message);
    }
    try {
      await request("DELETE", `/api/foods/${foodId}`, { expectStatus: 200 });
      await request("DELETE", `/api/categories/${catId}`, { expectStatus: 200 });
      log("pass", "DELETE /api/foods + empty category");
    } catch (e) {
      log("fail", "DELETE cleanup foods/category", e.message);
    }
  }

  // --- ORDERS ---
  try {
    await request("GET", "/api/orders", { expectStatus: 200 });
    log("pass", "GET /api/orders");
  } catch (e) {
    log("fail", "GET /api/orders", e.message);
  }

  try {
    await request("GET", "/api/orders/page", { expectStatus: 200 });
    log("pass", "GET /api/orders/page");
  } catch (e) {
    log("fail", "GET /api/orders/page", e.message);
  }

  // --- DRIVERS ---
  try {
    await request("GET", "/api/drivers", { expectStatus: 200 });
    log("pass", "GET /api/drivers");
  } catch (e) {
    log("fail", "GET /api/drivers", e.message);
  }

  try {
    await request("GET", "/api/drivers/2", { expectStatus: 200 });
    log("pass", "GET /api/drivers/:id");
  } catch (e) {
    log("fail", "GET /api/drivers/:id", e.message);
  }

  try {
    await request("GET", "/api/drivers/2/info", { expectStatus: 200 });
    log("pass", "GET /api/drivers/:id/info");
  } catch (e) {
    log("fail", "GET /api/drivers/:id/info", e.message);
  }

  try {
    await request("GET", "/api/drivers/2/location", { expectStatus: 200 });
    log("pass", "GET /api/drivers/:id/location");
  } catch (e) {
    log("fail", "GET /api/drivers/:id/location", e.message);
  }

  // --- PAYMENTS ---
  try {
    await request("GET", "/api/payments/1", { expectStatus: [200, 404].includes.bind ? undefined : 404 });
  } catch (_) {}

  try {
    const { status } = await request("GET", "/api/payments/99999");
    if (status === 404) log("pass", "GET /api/payments/:orderId not found → 404");
    else log("warn", "GET /api/payments/:orderId", `status=${status}`);
  } catch (e) {
    log("fail", "GET /api/payments/:orderId", e.message);
  }

  try {
    await request("POST", "/api/payments/create", {
      body: {},
      expectStatus: 400,
    });
    log("pass", "POST /api/payments/create missing fields → 400");
  } catch (e) {
    log("fail", "POST /api/payments/create validation", e.message);
  }

  // Security warnings (no auth on sensitive endpoints)
  log("warn", "Security: GET/POST/PUT/DELETE /api/users — no auth middleware");
  log("warn", "Security: CRUD /api/foods — no auth middleware");
  log("warn", "Security: CRUD /api/categories — no auth middleware");
  log("warn", "Security: CRUD /api/drivers — no auth middleware");
  log("warn", "Security: POST /api/orders — no auth (only /secure has auth)");
  log("warn", "Security: Password stored plain text in authController");

  printSummary();
}

function printSummary() {
  console.log("\n=== SUMMARY ===");
  console.log(`PASS: ${results.pass.length}`);
  console.log(`FAIL: ${results.fail.length}`);
  console.log(`WARN: ${results.warn.length}`);

  if (results.fail.length > 0) {
    console.log("\nFailed tests:");
    results.fail.forEach((f) => console.log(`  - ${f.name}: ${f.detail}`));
    process.exit(1);
  }
}

run().catch((e) => {
  console.error("Audit crashed:", e);
  process.exit(1);
});
