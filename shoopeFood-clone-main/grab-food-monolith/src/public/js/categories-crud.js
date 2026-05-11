const API_URL = "/api/categories";

const categoryForm = document.getElementById("categoryForm");
const categoryBody = document.getElementById("categoryBody");
const statusEl = document.getElementById("status");
const nameInput = document.getElementById("name");
const restaurantIdInput = document.getElementById("restaurantId");

let editingId = null;

const setStatus = (message, isError = false) => {
  statusEl.textContent = message;
  statusEl.style.color = isError ? "#b91c1c" : "#374151";
};

const fetchCategories = async () => {
  try {
    const res = await fetch(API_URL);
    const payload = await res.json();
    renderCategories(payload.data || []);
  } catch (error) {
    setStatus("Cannot load categories", true);
  }
};

const renderCategories = (categories) => {
  categoryBody.innerHTML = "";

  categories.forEach((category) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${category.id}</td>
      <td>${category.name}</td>
      <td>${category.restaurantId}</td>
      <td>
        <div class="actions">
          <button type="button" data-edit="${category.id}">Edit</button>
          <button type="button" class="btn-danger" data-delete="${category.id}">Delete</button>
        </div>
      </td>
    `;
    categoryBody.appendChild(tr);
  });
};

categoryForm.addEventListener("submit", async (event) => {
  event.preventDefault();

  const name = nameInput.value.trim();
  const restaurantId = Number(restaurantIdInput.value);

  if (!name || !Number.isFinite(restaurantId)) {
    setStatus("Please enter valid name and restaurant ID", true);
    return;
  }

  const method = editingId ? "PUT" : "POST";
  const url = editingId ? `${API_URL}/${editingId}` : API_URL;

  try {
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, restaurantId }),
    });

    const payload = await res.json();

    if (!res.ok) {
      setStatus(payload.message || "Save failed", true);
      return;
    }

    setStatus(editingId ? "Updated successfully" : "Created successfully");
    editingId = null;
    categoryForm.querySelector("button[type='submit']").textContent = "Save";
    categoryForm.reset();
    await fetchCategories();
  } catch (error) {
    setStatus("Save failed", true);
  }
});

categoryBody.addEventListener("click", async (event) => {
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
      restaurantIdInput.value = payload.data.restaurantId;
      categoryForm.querySelector("button[type='submit']").textContent = "Update";
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
        categoryForm.querySelector("button[type='submit']").textContent = "Save";
        categoryForm.reset();
      }

      setStatus("Deleted successfully");
      await fetchCategories();
    } catch (error) {
      setStatus("Delete failed", true);
    }
  }
});

fetchCategories();
