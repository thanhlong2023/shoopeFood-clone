const API_URL = "/api/foods";

const foodForm = document.getElementById("foodForm");
const foodBody = document.getElementById("foodBody");
const statusEl = document.getElementById("status");
const nameInput = document.getElementById("name");
const priceInput = document.getElementById("price");
const categoryIdInput = document.getElementById("categoryId");

let editingId = null;

const setStatus = (message, isError = false) => {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#374151";
};

const fetchFoods = async () => {
  try {
    const res = await fetch(API_URL);
    const payload = await res.json();
    renderFoods(payload.data || []);
  } catch (error) {
    setStatus("Cannot load foods", true);
  }
};

const renderFoods = (foods) => {
  foodBody.innerHTML = "";

  foods.forEach((food) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${food.id}</td>
      <td>${food.name}</td>
      <td>${food.price}</td>
      <td>${food.categoryId || ''}</td>
      <td>
        <div class="actions">
          <button type="button" data-edit="${food.id}">Edit</button>
          <button type="button" class="btn-danger" data-delete="${food.id}">Delete</button>
        </div>
      </td>
    `;
    foodBody.appendChild(tr);
  });
};

foodForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const price = Number(priceInput.value);
  const categoryIdValue = categoryIdInput.value.trim();
  const categoryId = categoryIdValue ? Number(categoryIdValue) : null;

  if (!name || !Number.isFinite(price)) {
    setStatus("Please enter valid name and price", true);
    return;
  }

  const method = editingId ? "PUT" : "POST";
  const url = editingId ? `${API_URL}/${editingId}` : API_URL;

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, price, categoryId }),
    });

    const payload = await res.json();

    if (!res.ok) {
      setStatus(payload.message || "Save failed", true);
      return;
    }

    setStatus(editingId ? "Updated successfully" : "Created successfully");
    editingId = null;
    foodForm.querySelector("button[type='submit']").textContent = "Save";
    foodForm.reset();
    await fetchFoods();
  } catch (error) {
    setStatus("Save failed", true);
  }
});

foodBody.addEventListener("click", async (event) => {
  const editId = event.target.getAttribute("data-edit");
  const deleteId = event.target.getAttribute("data-delete");

  if (editId) {
    try {
      const res = await fetch(`${API_URL}/${editId}`);
      const payload = await res.json();
      if (!res.ok) {
        setStatus(payload.message || "Cannot load item", true);
        return;
      }

      editingId = Number(editId);
      nameInput.value = payload.data.name;
      priceInput.value = payload.data.price;
      categoryIdInput.value = payload.data.categoryId || "";
      foodForm.querySelector("button[type='submit']").textContent = "Update";
      setStatus(`Editing item #${editingId}`);
    } catch (error) {
      setStatus("Cannot load item", true);
    }
  }

  if (deleteId) {
    try {
      const res = await fetch(`${API_URL}/${deleteId}`, { method: "DELETE" });
      const payload = await res.json();
      if (!res.ok) {
        setStatus(payload.message || "Delete failed", true);
        return;
      }

      if (editingId === Number(deleteId)) {
        editingId = null;
        foodForm.querySelector("button[type='submit']").textContent = "Save";
        foodForm.reset();
      }

      setStatus("Deleted successfully");
      await fetchFoods();
    } catch (error) {
      setStatus("Delete failed", true);
    }
  }
});

fetchFoods();