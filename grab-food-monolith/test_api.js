const BASE_URL = "http://localhost:3000/api";

async function testApi() {
  const log = (msg) => console.log(`[TEST] ${msg}`);
  const err = (msg) => console.error(`[ERROR] ${msg}`);
  
  try {
    // 1. Get initial categories
    log("Fetching categories...");
    let res = await fetch(`${BASE_URL}/categories`);
    let data = await res.json();
    log(`Initial categories count: ${data.data?.length}`);

    // 2. Create category with invalid restaurant
    log("Creating category with invalid restaurantId...");
    res = await fetch(`${BASE_URL}/categories`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Invalid", restaurantId: 9999 })
    });
    log(`Invalid restaurant status: ${res.status}`);

    // 3. Create valid category
    log("Creating valid category...");
    res = await fetch(`${BASE_URL}/categories`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Mon Trang Mieng", restaurantId: 1 })
    });
    let newCategory = await res.json();
    log(`Create category status: ${res.status}, ID: ${newCategory.data?.id}`);
    const catId = newCategory.data?.id;

    // 4. Create food with empty name
    log("Creating food with empty name spaces...");
    res = await fetch(`${BASE_URL}/foods`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "   ", price: 10000, categoryId: catId })
    });
    log(`Empty name food status: ${res.status}`);

    // 5. Create food with negative price
    log("Creating food with negative price...");
    res = await fetch(`${BASE_URL}/foods`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Banh flan", price: -100, categoryId: catId })
    });
    log(`Negative price food status: ${res.status}`);

    // 6. Create valid food
    log("Creating valid food...");
    res = await fetch(`${BASE_URL}/foods`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Banh flan", price: 15000, categoryId: catId })
    });
    let newFood = await res.json();
    log(`Create valid food status: ${res.status}, ID: ${newFood.data?.id}`);
    const foodId = newFood.data?.id;

    // 7. Search food by Name
    log("Searching food by name 'flan'...");
    res = await fetch(`${BASE_URL}/foods?name=flan`);
    data = await res.json();
    log(`Search results for 'flan': ${data.data?.length}`);

    // 8. Delete category containing food items
    log("Deleting category with existing foods...");
    res = await fetch(`${BASE_URL}/categories/${catId}`, { method: "DELETE" });
    log(`Delete filled category status: ${res.status} (expected 409)`);

    // 9. Delete food
    log("Deleting food...");
    res = await fetch(`${BASE_URL}/foods/${foodId}`, { method: "DELETE" });
    log(`Delete food status: ${res.status}`);

    // 10. Delete category now empty
    log("Deleting empty category...");
    res = await fetch(`${BASE_URL}/categories/${catId}`, { method: "DELETE" });
    log(`Delete empty category status: ${res.status}`);

    log("ALL VERIFICATIONS COMPLETED");
  } catch (error) {
    err(error.message);
  }
}

testApi();
