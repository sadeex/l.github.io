const DB_KEY = "fireStoreDatabaseV1";
const SESSION_KEY = "fireStoreSessionV1";
const ADMIN_USERNAME = "sadithas59@gmail.com";
const ADMIN_PASSCODE = "Time?7@@";

let currentStoreId = null;
let formMode = "user";

const pages = [
  "homePage",
  "createStorePage",
  "userDashboard",
  "adminLoginPage",
  "adminDashboard"
];

const sampleDb = {
  stores: [
    {
      id: "admin-store",
      storeName: "Fire Store Official",
      ownerName: "Admin",
      contactInfo: ADMIN_USERNAME,
      createdAt: new Date().toISOString(),
      isAdmin: true
    }
  ],
  products: [
    {
      id: "sample-1",
      storeId: "admin-store",
      storeName: "Fire Store Official",
      ownerName: "Admin",
      name: "Premium Blue Headset",
      category: "Electronics",
      price: "Rs. 7,500",
      description: "High quality headset with clear sound, soft ear cushions and a clean dark blue design.",
      image: "",
      views: 14,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    },
    {
      id: "sample-2",
      storeId: "admin-store",
      storeName: "Fire Store Official",
      ownerName: "Admin",
      name: "White Smart Watch",
      category: "Gadgets",
      price: "Rs. 12,900",
      description: "Stylish smart watch with fitness tracking, notifications and long lasting battery life.",
      image: "",
      views: 8,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }
  ]
};

function loadDb() {
  const saved = localStorage.getItem(DB_KEY);
  if (!saved) {
    saveDb(sampleDb);
    return structuredClone(sampleDb);
  }

  try {
    const db = JSON.parse(saved);
    db.stores = Array.isArray(db.stores) ? db.stores : [];
    db.products = Array.isArray(db.products) ? db.products : [];
    return db;
  } catch (error) {
    console.warn("Database was reset because saved data was corrupted.", error);
    saveDb(sampleDb);
    return structuredClone(sampleDb);
  }
}

function saveDb(db) {
  localStorage.setItem(DB_KEY, JSON.stringify(db));
}

function getSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || { isAdmin: false, storeId: null };
  } catch {
    return { isAdmin: false, storeId: null };
  }
}

function setSession(session) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

function uid(prefix = "id") {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value = "") {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function shortText(text, length = 105) {
  const safe = String(text || "").trim();
  return safe.length > length ? `${safe.slice(0, length)}...` : safe;
}

function showPage(pageId) {
  pages.forEach(id => document.getElementById(id).classList.toggle("active", id === pageId));
  window.scrollTo({ top: 0, behavior: "smooth" });
  syncNav();
}

function goHome() {
  currentStoreId = getSession().storeId;
  showPage("homePage");
  renderAll();
}

function scrollToProducts() {
  document.getElementById("productsTop").scrollIntoView({ behavior: "smooth", block: "start" });
}

function showCreateStore() {
  showPage("createStorePage");
}

function showAdminLogin() {
  if (getSession().isAdmin) {
    showAdminDashboard();
    return;
  }
  showPage("adminLoginPage");
}

function showUserDashboard(storeId) {
  currentStoreId = storeId;
  setSession({ ...getSession(), storeId });
  const db = loadDb();
  const store = db.stores.find(item => item.id === storeId);

  if (!store) {
    toast("Store not found. Please create a new store.");
    showCreateStore();
    return;
  }

  document.getElementById("dashboardTitle").textContent = store.storeName;
  document.getElementById("dashboardSub").textContent = `Owner: ${store.ownerName} • Contact: ${store.contactInfo}`;
  showPage("userDashboard");
  renderUserDashboard();
}

function showAdminDashboard() {
  if (!getSession().isAdmin) {
    showAdminLogin();
    return;
  }
  showPage("adminDashboard");
  renderAdminDashboard();
}

function syncNav() {
  const isAdmin = getSession().isAdmin;
  document.getElementById("adminNavBtn").textContent = isAdmin ? "Admin Dashboard" : "Admin Login";
  document.getElementById("adminLogoutBtn").classList.toggle("hidden", !isAdmin);
}

function toast(message) {
  const el = document.getElementById("toast");
  el.textContent = message;
  el.classList.remove("hidden");
  clearTimeout(window.toastTimer);
  window.toastTimer = setTimeout(() => el.classList.add("hidden"), 2600);
}

function updateMetrics() {
  const db = loadDb();
  const userStores = db.stores.filter(store => !store.isAdmin).length;
  const totalViews = db.products.reduce((sum, product) => sum + Number(product.views || 0), 0);

  document.getElementById("metricProducts").textContent = db.products.length;
  document.getElementById("metricStores").textContent = userStores;
  document.getElementById("metricViews").textContent = totalViews;
}

function renderCategoryFilter() {
  const db = loadDb();
  const categories = [...new Set(db.products.map(product => product.category).filter(Boolean))].sort();
  const select = document.getElementById("categoryFilter");
  const oldValue = select.value || "all";
  select.innerHTML = `<option value="all">All Categories</option>` + categories.map(category => (
    `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`
  )).join("");
  select.value = categories.includes(oldValue) ? oldValue : "all";
}

function renderAdminStoreFilter() {
  const db = loadDb();
  const select = document.getElementById("adminStoreFilter");
  const oldValue = select.value || "all";
  select.innerHTML = `<option value="all">All Stores</option>` + db.stores.map(store => (
    `<option value="${escapeHtml(store.id)}">${escapeHtml(store.storeName)}</option>`
  )).join("");
  select.value = db.stores.some(store => store.id === oldValue) ? oldValue : "all";
}

function filteredHomeProducts() {
  const db = loadDb();
  const query = document.getElementById("searchInput").value.trim().toLowerCase();
  const category = document.getElementById("categoryFilter").value;

  return db.products
    .filter(product => category === "all" || product.category === category)
    .filter(product => {
      if (!query) return true;
      return [product.name, product.category, product.description, product.price, product.storeName, product.ownerName]
        .some(value => String(value || "").toLowerCase().includes(query));
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

function productInitial(product) {
  return (product.name || "F").trim().charAt(0).toUpperCase() || "F";
}

function productCard(product, options = {}) {
  const canEdit = Boolean(options.canEdit);
  const cardClick = options.clickable === false ? "" : `onclick="openProductDetail('${product.id}')" role="button" tabindex="0"`;
  const imageHtml = product.image
    ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" onerror="this.parentElement.innerHTML='${productInitial(product)}'" />`
    : productInitial(product);

  return `
    <article class="product-card" ${cardClick}>
      <div class="product-image">${imageHtml}</div>
      <div class="product-body">
        <div class="product-topline">
          <span class="category-chip">${escapeHtml(product.category)}</span>
          <span class="view-chip">👁 ${Number(product.views || 0)} views</span>
        </div>
        <h3>${escapeHtml(product.name)}</h3>
        <p class="product-desc">${escapeHtml(shortText(product.description))}</p>
        <div class="price-row">
          <span class="price">${escapeHtml(product.price)}</span>
          <span class="store-name">${escapeHtml(product.storeName || "Fire Store")}</span>
        </div>
        ${canEdit ? `
          <div class="card-actions" onclick="event.stopPropagation()">
            <button class="white-btn small" onclick="openProductForm('${options.mode || "user"}', '${product.id}')">Edit</button>
            <button class="danger-btn small" onclick="deleteProduct('${product.id}', '${options.mode || "user"}')">Delete</button>
          </div>
        ` : ""}
      </div>
    </article>
  `;
}

function renderProducts() {
  renderCategoryFilter();
  const products = filteredHomeProducts();
  const grid = document.getElementById("productGrid");
  const empty = document.getElementById("emptyState");

  grid.innerHTML = products.map(product => productCard(product)).join("");
  empty.classList.toggle("hidden", products.length !== 0);
}

function renderUserDashboard() {
  const db = loadDb();
  const store = db.stores.find(item => item.id === currentStoreId);
  if (!store) return;

  document.getElementById("dashboardTitle").textContent = store.storeName;
  document.getElementById("dashboardSub").textContent = `Owner: ${store.ownerName} • Contact: ${store.contactInfo}`;

  const products = db.products
    .filter(product => product.storeId === currentStoreId)
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  document.getElementById("userProductGrid").innerHTML = products
    .map(product => productCard(product, { canEdit: true, mode: "user" }))
    .join("");
  document.getElementById("userEmpty").classList.toggle("hidden", products.length !== 0);
}

function renderAdminDashboard() {
  if (!getSession().isAdmin) return;

  renderAdminStoreFilter();
  const db = loadDb();
  const query = document.getElementById("adminSearchInput").value.trim().toLowerCase();
  const storeFilter = document.getElementById("adminStoreFilter").value;

  const products = db.products
    .filter(product => storeFilter === "all" || product.storeId === storeFilter)
    .filter(product => {
      if (!query) return true;
      return [product.name, product.category, product.description, product.price, product.storeName, product.ownerName]
        .some(value => String(value || "").toLowerCase().includes(query));
    })
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

  document.getElementById("adminProductGrid").innerHTML = products
    .map(product => productCard(product, { canEdit: true, mode: "admin" }))
    .join("");
  document.getElementById("adminEmpty").classList.toggle("hidden", products.length !== 0);
}

function renderAll() {
  updateMetrics();
  renderProducts();
  renderUserDashboard();
  if (getSession().isAdmin) renderAdminDashboard();
  syncNav();
}

function openProductDetail(productId) {
  const db = loadDb();
  const product = db.products.find(item => item.id === productId);
  if (!product) return;

  product.views = Number(product.views || 0) + 1;
  product.updatedAt = product.updatedAt || product.createdAt;
  saveDb(db);

  const imageHtml = product.image
    ? `<img src="${escapeHtml(product.image)}" alt="${escapeHtml(product.name)}" />`
    : `<div class="fallback">${productInitial(product)}</div>`;

  document.getElementById("productDetail").innerHTML = `
    <div class="detail-meta">
      <span class="category-chip">${escapeHtml(product.category)}</span>
      <span class="view-chip">👁 ${Number(product.views || 0)} views</span>
      <span class="view-chip">Store: ${escapeHtml(product.storeName || "Fire Store")}</span>
    </div>
    <h2 class="detail-title">${escapeHtml(product.name)}</h2>
    <div class="detail-image">${imageHtml}</div>
    <h3 class="price">${escapeHtml(product.price)}</h3>
    <p class="detail-desc">${escapeHtml(product.description)}</p>
    <p class="muted">Owner: ${escapeHtml(product.ownerName || "Unknown")} • Added: ${new Date(product.createdAt).toLocaleString()}</p>
  `;

  document.getElementById("productModal").classList.remove("hidden");
  renderAll();
}

function closeProductModal() {
  document.getElementById("productModal").classList.add("hidden");
}

function openProductForm(mode = "user", productId = "") {
  formMode = mode;
  const session = getSession();
  const db = loadDb();

  if (mode === "admin" && !session.isAdmin) {
    toast("Please login as admin first.");
    showAdminLogin();
    return;
  }

  if (mode === "user" && !currentStoreId) {
    toast("Please create your Fire Store first.");
    showCreateStore();
    return;
  }

  const form = document.getElementById("productForm");
  form.reset();
  document.getElementById("editingProductId").value = productId;

  if (productId) {
    const product = db.products.find(item => item.id === productId);
    if (!product) return;

    if (mode === "user" && product.storeId !== currentStoreId) {
      toast("You can edit only your own store products.");
      return;
    }

    document.getElementById("productFormTitle").textContent = "Edit Product";
    document.getElementById("productFormHint").textContent = `Editing: ${product.name}`;
    document.getElementById("productName").value = product.name;
    document.getElementById("productCategory").value = product.category;
    document.getElementById("productPrice").value = product.price;
    document.getElementById("productDescription").value = product.description;
    document.getElementById("productImage").value = product.image || "";
  } else {
    document.getElementById("productFormTitle").textContent = mode === "admin" ? "Add Admin Product" : "Add Product";
    document.getElementById("productFormHint").textContent = mode === "admin"
      ? "Admin product will be saved under Fire Store Official."
      : "Add product details for your own Fire Store.";
  }

  document.getElementById("productFormModal").classList.remove("hidden");
}

function closeProductForm() {
  document.getElementById("productFormModal").classList.add("hidden");
}

function deleteProduct(productId, mode = "user") {
  const db = loadDb();
  const product = db.products.find(item => item.id === productId);
  if (!product) return;

  if (mode === "admin" && !getSession().isAdmin) {
    toast("Admin login required.");
    return;
  }

  if (mode === "user" && product.storeId !== currentStoreId) {
    toast("You can delete only your own store products.");
    return;
  }

  const ok = confirm(`Delete "${product.name}"?`);
  if (!ok) return;

  db.products = db.products.filter(item => item.id !== productId);
  saveDb(db);
  renderAll();
  toast("Product deleted.");
}

function getAdminStore(db) {
  let store = db.stores.find(item => item.id === "admin-store");
  if (!store) {
    store = {
      id: "admin-store",
      storeName: "Fire Store Official",
      ownerName: "Admin",
      contactInfo: ADMIN_USERNAME,
      createdAt: new Date().toISOString(),
      isAdmin: true
    };
    db.stores.unshift(store);
  }
  return store;
}

document.getElementById("storeForm").addEventListener("submit", event => {
  event.preventDefault();
  const db = loadDb();
  const store = {
    id: uid("store"),
    storeName: document.getElementById("storeName").value.trim(),
    ownerName: document.getElementById("ownerName").value.trim(),
    contactInfo: document.getElementById("contactInfo").value.trim(),
    createdAt: new Date().toISOString(),
    isAdmin: false
  };

  db.stores.push(store);
  saveDb(db);
  event.target.reset();
  currentStoreId = store.id;
  setSession({ ...getSession(), storeId: store.id });
  toast("Your Fire Store was created.");
  showUserDashboard(store.id);
  renderAll();
});

document.getElementById("adminLoginForm").addEventListener("submit", event => {
  event.preventDefault();
  const username = document.getElementById("adminUsername").value.trim();
  const passcode = document.getElementById("adminPasscode").value;

  if (username === ADMIN_USERNAME && passcode === ADMIN_PASSCODE) {
    setSession({ ...getSession(), isAdmin: true });
    event.target.reset();
    toast("Admin logged in successfully.");
    showAdminDashboard();
  } else {
    toast("Wrong admin username or passcode.");
  }
});

function logoutAdmin() {
  setSession({ ...getSession(), isAdmin: false });
  toast("Admin logged out.");
  goHome();
}

document.getElementById("productForm").addEventListener("submit", event => {
  event.preventDefault();
  const db = loadDb();
  const productId = document.getElementById("editingProductId").value;
  const name = document.getElementById("productName").value.trim();
  const category = document.getElementById("productCategory").value.trim();
  const price = document.getElementById("productPrice").value.trim();
  const description = document.getElementById("productDescription").value.trim();
  const image = document.getElementById("productImage").value.trim();
  const now = new Date().toISOString();

  if (productId) {
    const product = db.products.find(item => item.id === productId);
    if (!product) return;

    if (formMode === "admin" && !getSession().isAdmin) {
      toast("Admin login required.");
      return;
    }

    if (formMode === "user" && product.storeId !== currentStoreId) {
      toast("You can edit only your own store products.");
      return;
    }

    product.name = name;
    product.category = category;
    product.price = price;
    product.description = description;
    product.image = image;
    product.updatedAt = now;
    toast("Product updated.");
  } else {
    let store;
    if (formMode === "admin") {
      if (!getSession().isAdmin) {
        toast("Admin login required.");
        return;
      }
      store = getAdminStore(db);
    } else {
      store = db.stores.find(item => item.id === currentStoreId);
      if (!store) {
        toast("Please create your Fire Store first.");
        return;
      }
    }

    db.products.push({
      id: uid("product"),
      storeId: store.id,
      storeName: store.storeName,
      ownerName: store.ownerName,
      name,
      category,
      price,
      description,
      image,
      views: 0,
      createdAt: now,
      updatedAt: now
    });
    toast("Product added.");
  }

  saveDb(db);
  closeProductForm();
  renderAll();
});

document.addEventListener("keydown", event => {
  if (event.key === "Escape") {
    closeProductModal();
    closeProductForm();
  }
});

document.querySelectorAll(".modal").forEach(modal => {
  modal.addEventListener("click", event => {
    if (event.target === modal) {
      modal.classList.add("hidden");
    }
  });
});

function boot() {
  const session = getSession();
  currentStoreId = session.storeId;
  syncNav();
  renderAll();
}

boot();
