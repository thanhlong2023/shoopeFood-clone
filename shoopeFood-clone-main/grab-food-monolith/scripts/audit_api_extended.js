/**
 * Extended API audit — order flow, restaurant mutations
 */
const BASE = process.env.API_BASE || "http://localhost:3000";
const results = { pass: [], fail: [], warn: [] };

function log(type, name, detail) {
  results[type].push({ name, detail });
  console.log(`[${type === "pass" ? "OK" : type === "fail" ? "FAIL" : "WARN"}] ${name}${detail ? ` — ${detail}` : ""}`);
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
  try { json = text ? JSON.parse(text) : null; } catch { json = { raw: text }; }
  if (expectStatus !== undefined && res.status !== expectStatus) {
    throw new Error(`Expected ${expectStatus}, got ${res.status}: ${JSON.stringify(json)}`);
  }
  return { status: res.status, json };
}

async function login(phone, role) {
  const { json } = await request("POST", "/api/auth/login", {
    body: { phone, password: "123456", role },
    expectStatus: 200,
  });
  return json.data.token;
}

async function run() {
  console.log(`\n=== Extended API Audit: ${BASE} ===\n`);
  const adminToken = await login("0900000005", "ADMIN");
  const merchantToken = await login("0900000003", "MERCHANT");
  const customerToken = await login("0900000001", "CUSTOMER");

  // Restaurant create (admin)
  try {
    const { json } = await request("POST", "/api/restaurants", {
      token: adminToken,
      body: {
        ownerId: 3,
        name: `Audit Restaurant ${Date.now()}`,
        address: "123 Test St",
        latitude: 10.77,
        longitude: 106.69,
      },
      expectStatus: 201,
    });
    const rid = json.data?.id;
    log("pass", "POST /api/restaurants (admin)", `id=${rid}`);

    await request("PUT", `/api/restaurants/${rid}`, {
      token: adminToken,
      body: { imageUrl: "https://example.com/test.jpg" },
      expectStatus: 200,
    });
    log("pass", "PUT /api/restaurants/:id imageUrl (admin)");

    await request("DELETE", `/api/restaurants/${rid}`, { token: adminToken, expectStatus: 200 });
    log("pass", "DELETE /api/restaurants/:id (admin)");
  } catch (e) {
    log("fail", "Restaurant admin CRUD", e.message);
  }

  // Merchant update imageUrl
  try {
    const { json: mine } = await request("GET", "/api/restaurants/mine", { token: merchantToken, expectStatus: 200 });
    const restaurant = mine.data?.[0];
    if (!restaurant) throw new Error("Merchant has no restaurant");
    await request("PUT", `/api/restaurants/${restaurant.id}`, {
      token: merchantToken,
      body: { imageUrl: "https://example.com/merchant.jpg" },
      expectStatus: 200,
    });
    log("pass", "PUT /api/restaurants/:id imageUrl (merchant owner)");
  } catch (e) {
    log("fail", "Merchant restaurant imageUrl update", e.message);
  }

  // Order flow
  try {
    const { json: restaurants } = await request("GET", "/api/restaurants", { expectStatus: 200 });
    const restaurant = restaurants.data?.[0];
    const { json: foods } = await request("GET", `/api/foods?restaurantId=${restaurant.id}`, { expectStatus: 200 });
    const food = foods.data?.find((f) => f.isAvailable) || foods.data?.[0];

    if (!food) {
      log("warn", "Order create test skipped", "no foods available");
    } else {
      const { json } = await request("POST", "/api/orders/secure", {
        token: customerToken,
        body: {
          customerId: 1,
          restaurantId: restaurant.id,
          receiverAddress: "1 Test Address",
          receiverLat: 10.78,
          receiverLng: 106.7,
          distanceKm: 2,
          items: [{ foodId: food.id, quantity: 1 }],
          idempotencyKey: `audit-${Date.now()}`,
        },
        expectStatus: 201,
      });
      const orderId = json.data?.id;
      log("pass", "POST /api/orders/secure", `orderId=${orderId}`);

      await request("GET", `/api/orders/${orderId}`, { expectStatus: 200 });
      log("pass", "GET /api/orders/:id");

      await request("GET", `/api/orders/${orderId}/tracking`, { expectStatus: 200 });
      log("pass", "GET /api/orders/:id/tracking");

      await request("POST", "/api/payments/create", {
        body: { orderId, idempotencyKey: `pay-${Date.now()}`, paymentMethod: "E_WALLET" },
        expectStatus: 201,
      });
      log("pass", "POST /api/payments/create (E_WALLET)");

      await request("POST", "/api/payments/create", {
        body: { orderId, idempotencyKey: `pay-invalid-${Date.now()}`, paymentMethod: "MOMO" },
        expectStatus: 400,
      });
      log("pass", "POST /api/payments/create invalid method → 400");
    }
  } catch (e) {
    log("fail", "Order + payment flow", e.message);
  }

  // Unauthenticated restaurant create
  try {
    await request("POST", "/api/restaurants", {
      body: { name: "Hack", ownerId: 1 },
      expectStatus: 401,
    });
    log("pass", "POST /api/restaurants without auth → 401");
  } catch (e) {
    log("fail", "POST /api/restaurants no auth", e.message);
  }

  // Invalid login role (driver account cannot login as merchant)
  try {
    await request("POST", "/api/auth/login", {
      body: { phone: "0900000002", password: "123456", role: "MERCHANT" },
      expectStatus: 403,
    });
    log("pass", "Login wrong role → 403");
  } catch (e) {
    log("fail", "Login wrong role", e.message);
  }

  console.log(`\nPASS: ${results.pass.length} | FAIL: ${results.fail.length} | WARN: ${results.warn.length}`);
  if (results.fail.length) process.exit(1);
}

run().catch((e) => { console.error(e); process.exit(1); });
