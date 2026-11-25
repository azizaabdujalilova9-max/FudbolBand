const drawer = document.getElementById("bookingDrawer");
const overlay = document.getElementById("overlay");
const form = document.getElementById("bookingForm");
const toast = document.getElementById("toast");
const sidebar = document.getElementById("sidebar");
const content = document.querySelector(".content");

const PAYMENT_STORAGE_KEY = "maydonband_payments";
const demoPaymentIds = Array.from({ length: 20 }, (_, index) =>
  `MB-${String(index + 1001).padStart(4, "0")}`
);

function localDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadPayments() {
  try {
    const saved = JSON.parse(localStorage.getItem(PAYMENT_STORAGE_KEY));
    if (Array.isArray(saved)) {
      const demoIds = new Set(demoPaymentIds);
      const realPayments = saved.filter((payment) => !demoIds.has(payment.id));
      if (realPayments.length !== saved.length) {
        localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(realPayments));
      }
      return realPayments;
    }
  } catch (_) {}
  return [];
}

let paymentRecords = loadPayments();

function formatSum(amount) {
  return Math.max(0, Number(amount) || 0).toLocaleString("uz-UZ").replace(/\u00a0/g, " ");
}

function nextBookingReference() {
  const maxNumber = paymentRecords.reduce((max, payment) => {
    const match = String(payment.booking || "").match(/MB-(\d+)/);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 1000);
  return `#MB-${maxNumber + 1}`;
}

function calculatePayments() {
  const todayKey = localDateKey(new Date());
  const weekStartDate = new Date();
  weekStartDate.setHours(0, 0, 0, 0);
  const daysSinceMonday = (weekStartDate.getDay() + 6) % 7;
  weekStartDate.setDate(weekStartDate.getDate() - daysSinceMonday);
  const weekStart = localDateKey(weekStartDate);
  const todayRevenue = paymentRecords
    .filter((payment) => payment.date === todayKey && payment.type === "paid")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const pendingAdvance = paymentRecords
    .filter((payment) => payment.date === todayKey && payment.type === "advance")
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  const weeklyRevenue = paymentRecords
    .filter((payment) => payment.date >= weekStart && payment.date <= todayKey)
    .reduce((sum, payment) => sum + Number(payment.amount), 0);
  return { todayRevenue, pendingAdvance, weeklyRevenue };
}

function openDrawer(field, time) {
  drawer.classList.add("open");
  overlay.classList.add("show");
  drawer.setAttribute("aria-hidden", "false");
  if (field) document.getElementById("fieldSelect").value = field;
  if (time) {
    const timeSelect = document.getElementById("timeSelect");
    for (const option of timeSelect.options) {
      if (option.text.startsWith(time)) timeSelect.value = option.value;
    }
  }
}

function closeDrawer() {
  drawer.classList.remove("open");
  document.getElementById("paymentDrawer")?.classList.remove("open");
  overlay.classList.remove("show");
  drawer.setAttribute("aria-hidden", "true");
  document.getElementById("paymentDrawer")?.setAttribute("aria-hidden", "true");
  sidebar.classList.remove("open");
}

document.getElementById("openBooking").addEventListener("click", () => openDrawer());
document.getElementById("closeDrawer").addEventListener("click", closeDrawer);
document.getElementById("closePaymentDrawer").addEventListener("click", closeDrawer);
overlay.addEventListener("click", closeDrawer);
document.getElementById("menuButton").addEventListener("click", () => {
  sidebar.classList.toggle("open");
  overlay.classList.toggle("show");
});

document.querySelectorAll(".slot.available").forEach((slot) => {
  slot.addEventListener("click", () => openDrawer(slot.dataset.field, slot.dataset.time));
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  const field = document.getElementById("fieldSelect").value;
  const time = document.getElementById("timeSelect").value;
  const recurring = document.getElementById("recurringBooking").checked;
  if (recurring) {
    document.getElementById("timeSelect").value = "20:00–21:00";
  }
  const startTime = (recurring ? "20:00" : time).slice(0, 5);
  let conflict = false;
  document.querySelectorAll(".schedule-row").forEach((row) => {
    if (row.querySelector(".time")?.textContent.trim() === startTime) {
      const fieldIndex = ["Maydon 1", "Maydon 2", "Maydon 3"].indexOf(field);
      const slot = row.querySelectorAll(".slot")[fieldIndex];
      if (slot && !slot.classList.contains("available")) conflict = true;
    }
  });
  if (conflict) {
    showToast("Bu maydon va soat band");
    return;
  }
  const paymentType = document.querySelector('input[name="payment"]:checked')?.value || "full";
  const paidAmount = paymentType === "advance" ? 175000 : 350000;
  paymentRecords.push({
    id: `MB-${Date.now()}`,
    customer: document.getElementById("customerName").value || "Yangi mijoz",
    booking: `#MB-${Date.now().toString().slice(-4)}`,
    amount: paidAmount,
    type: paymentType === "advance" ? "advance" : "paid",
    date: localDateKey(new Date())
  });
  localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(paymentRecords));
  closeDrawer();
  toast.classList.add("show");
  const todayCount = document.getElementById("todayCount");
  if (todayCount) todayCount.textContent =
    String(Number(todayCount.textContent) + 1);
  form.reset();
  setTimeout(() => toast.classList.remove("show"), 3000);
});

document.getElementById("paymentForm").addEventListener("submit", (event) => {
  event.preventDefault();
  const customer = document.getElementById("paymentCustomer").value.trim();
  const booking = document.getElementById("paymentBooking").value.trim();
  const amount = Number(document.getElementById("paymentAmount").value);
  const date = document.getElementById("paymentDate").value;
  const type = document.querySelector('input[name="paymentType"]:checked')?.value || "paid";
  if (!customer || !booking || !Number.isFinite(amount) || amount <= 0) {
    showToast("To‘lov ma’lumotlarini to‘ldiring");
    return;
  }
  paymentRecords.push({
    id: `MB-${Date.now()}`,
    customer,
    booking,
    amount,
    type,
    date
  });
  localStorage.setItem(PAYMENT_STORAGE_KEY, JSON.stringify(paymentRecords));
  event.currentTarget.reset();
  closeDrawer();
  renderPayments();
  showToast(type === "paid" ? "To‘liq to‘lov saqlandi" : "Avans saqlandi");
});

const dashboardTemplate = content.innerHTML;

function renderFields() {
  content.innerHTML = `
    <section class="page-heading"><div><p class="eyebrow">Maydonlar boshqaruvi</p><h1>Maydonlar</h1></div><button class="primary-button" id="addField">Maydon qo‘shish</button></section>
    <section class="module-grid field-grid">
      ${["Maydon 1", "Maydon 2", "Maydon 3"].map((name, i) => `
        <article class="panel field-card" data-search-row>
          <div class="field-preview"><span>${i + 1}</span><small>${i === 0 ? "Ochiq maydon" : i === 1 ? "Qoplangan maydon" : "Ochiq maydon"}</small></div>
          <div class="field-card-body"><div><h2>${name}</h2><p>08:00–23:00 · ${i === 1 ? "400" : i === 2 ? "380" : "350"} 000 so‘m/kecha</p></div><span class="status paid">Faol</span></div>
          <div class="field-actions"><button class="secondary-button" data-edit-field>Sozlash</button><button class="text-button" data-open-field>Bandlik</button></div>
        </article>`).join("")}
    </section>`;
  bindModuleActions();
}

function renderBookings() {
  content.innerHTML = `
    <section class="page-heading"><div><p class="eyebrow">Bron boshqaruvi</p><h1>Bronlar</h1></div><button class="primary-button" id="moduleBooking">Yangi bron</button></section>
    <section class="panel module-panel">
      <div class="module-toolbar"><div class="module-tabs"><button class="active" data-filter="all">Barchasi</button><button data-filter="advance">Kutilmoqda</button><button data-filter="paid">Tasdiqlangan</button></div><select id="bookingStatusFilter"><option value="all">Barcha holatlar</option><option value="advance">Avans</option><option value="paid">To‘liq to‘langan</option></select></div>
      <div class="data-table">
        <div class="table-head"><span>Jamoa</span><span>Maydon</span><span>Sana va vaqt</span><span>To‘lov</span><span>Holat</span><span></span></div>
        ${[
          ["Yulduzlar FC", "Maydon 3", "23 noyabr · 08:00", "350 000", "paid", "Tasdiqlangan"],
          ["Akmal Jo‘rayev", "Maydon 1", "23 noyabr · 09:00", "250 000", "paid", "Tasdiqlangan"],
          ["Azizbek Rahimov", "Maydon 2", "23 noyabr · 10:00", "175 000", "advance", "Kutilmoqda"],
          ["Vortex team", "Maydon 3", "23 noyabr · 14:00", "—", "advance", "Avans kutilmoqda"]
        ].map(row => `<div class="table-row" data-status="${row[4]}" data-search-row><strong>${row[0]}</strong><span>${row[1]}</span><span>${row[2]}</span><span>${row[3]} so‘m</span><span class="status ${row[4]}">${row[5]}</span><button class="text-button" data-view-booking>Ochish</button></div>`).join("")}
      </div>
    </section>`;
  bindModuleActions();
}

function renderCustomers() {
  content.innerHTML = `
    <section class="page-heading"><div><p class="eyebrow">Mijozlar bazasi</p><h1>Mijozlar</h1></div><button class="primary-button" id="addCustomer">Mijoz qo‘shish</button></section>
    <section class="stats customer-stats">
      <article class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24"><path d="M16 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8ZM8 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm8 1c-3.7 0-6 1.9-6 4v3h12v-3c0-2.1-2.3-4-6-4ZM8 14c-3.3 0-6 1.7-6 4v2h6v-3c0-1.1.4-2.1 1-3Z"/></svg></div><div><p>Jami mijozlar</p><strong>148</strong><small>bu oy +12</small></div></article>
      <article class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5-10-5Zm-8 8v6l8 4 8-4v-6l-8 4-8-4Z"/></svg></div><div><p>Faol jamoalar</p><strong>36</strong><small>5 ta bloklangan</small></div></article>
      <article class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 11h5v-2h-5V6h-2v7H7v2h6v-2Z"/></svg></div><div><p>Kelmaganlar</p><strong>9</strong><small>bu hafta</small></div></article>
    </section>
    <section class="panel module-panel"><div class="module-toolbar"><div><h2>Jamoalar va mijozlar</h2></div><select id="customerFilter"><option value="all">Barchasi</option><option value="blocked">Bloklangan</option><option value="active">Faol</option></select></div>
      <div class="data-table customer-table">
        <div class="table-head"><span>Mijoz</span><span>Telefon</span><span>Bronlar</span><span>Kelmagan</span><span>Holat</span><span></span></div>
        ${[
          ["Yulduzlar FC", "+998 90 123 45 67", "12", "0", "active", "Faol"],
          ["Olmos jamoasi", "+998 93 555 22 11", "8", "1", "active", "Faol"],
          ["Vortex team", "+998 99 100 20 30", "6", "3", "blocked", "Bloklangan"],
          ["Akmal Jo‘rayev", "+998 91 444 33 22", "4", "0", "active", "Faol"]
        ].map(row => `<div class="table-row" data-status="${row[4]}" data-search-row><strong>${row[0]}</strong><span>${row[1]}</span><span>${row[2]}</span><span class="${row[3] === "3" ? "miss-count" : ""}">${row[3]} marta</span><span class="status ${row[4] === "blocked" ? "absent-status" : "paid"}">${row[5]}</span><button class="text-button" data-view-customer>Profil</button></div>`).join("")}
      </div>
    </section>`;
  bindModuleActions();
}

function renderPayments() {
  const totals = calculatePayments();
  content.innerHTML = `
    <section class="page-heading"><div><p class="eyebrow">Moliyaviy nazorat</p><h1>To‘lovlar</h1></div><button class="primary-button" id="recordPayment">To‘lov qo‘shish</button></section>
    <section class="stats">
      <article class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24"><path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-18 2h18v3H3V6Zm18 12H3v-7h18v7Z"/></svg></div><div><p>Bugungi tushum</p><strong id="dynamicTodayRevenue">${formatSum(totals.todayRevenue)}</strong><small>so‘m</small></div></article>
      <article class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24"><path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-18 2h18v3H3V6Zm18 12H3v-7h18v7Z"/></svg></div><div><p>Kutilayotgan avans</p><strong id="dynamicPendingAdvance">${formatSum(totals.pendingAdvance)}</strong><small>so‘m</small></div></article>
      <article class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 11h5v-2h-5V6h-2v7H7v2h6v-2Z"/></svg></div><div><p>Haftalik tushum</p><strong id="dynamicWeeklyRevenue">${formatSum(totals.weeklyRevenue)}</strong><small>so‘m · to‘lovlardan</small></div></article>
    </section>
    <section class="panel module-panel"><div class="module-toolbar"><div><h2>Oxirgi to‘lovlar</h2></div><select id="paymentFilter"><option value="all">Barchasi</option><option value="advance">Avans</option><option value="paid">To‘liq</option></select></div>
      <div class="data-table payment-table">
        <div class="table-head"><span>Mijoz</span><span>Bron</span><span>Summa</span><span>To‘lov turi</span><span>Holat</span><span></span></div>
        ${[...paymentRecords].reverse().map(payment => `
          <div class="table-row" data-status="${payment.type}" data-search-row>
            <strong>${payment.customer}</strong><span>${payment.booking}</span><span>${formatSum(payment.amount)} so‘m</span>
            <span>${payment.type === "paid" ? "To‘liq" : "Avans"}</span>
            <span class="status ${payment.type}">To‘langan</span>
            <button class="text-button" data-view-payment>Chek</button>
          </div>`).join("")}
      </div>
    </section>`;
  bindModuleActions();
}

function bindModuleActions() {
  document.getElementById("moduleBooking")?.addEventListener("click", () => openDrawer());
  document.getElementById("addField")?.addEventListener("click", () => showToast("Yangi maydon qo‘shish oynasi"));
  document.getElementById("addCustomer")?.addEventListener("click", () => showToast("Yangi mijoz qo‘shish oynasi"));
  document.getElementById("recordPayment")?.addEventListener("click", () => {
    const paymentDrawer = document.getElementById("paymentDrawer");
    document.getElementById("paymentBooking").value = nextBookingReference();
    document.getElementById("paymentDate").value = localDateKey(new Date());
    paymentDrawer.classList.add("open");
    paymentDrawer.setAttribute("aria-hidden", "false");
    overlay.classList.add("show");
  });
  document.querySelectorAll("[data-edit-field]").forEach(button => button.addEventListener("click", () => showToast("Maydon sozlamalari ochildi")));
  document.querySelectorAll("[data-open-field]").forEach(button => button.addEventListener("click", () => {
    document.querySelector('.nav-item[href="#fields"]').click();
  }));
  document.querySelectorAll("[data-view-booking]").forEach(button => button.addEventListener("click", () => showToast("Bron tafsiloti ochildi")));
  document.querySelectorAll("[data-view-customer]").forEach(button => button.addEventListener("click", () => showToast("Mijoz profili ochildi")));
  document.querySelectorAll("[data-view-payment]").forEach(button => button.addEventListener("click", () => showToast("To‘lov cheki ochildi")));

  const filter = document.querySelector("#bookingStatusFilter, #customerFilter, #paymentFilter");
  filter?.addEventListener("change", () => {
    document.querySelectorAll(".table-row").forEach(row => {
      row.style.display = filter.value === "all" || row.dataset.status === filter.value ? "" : "none";
    });
  });
  document.querySelectorAll("[data-filter]").forEach(button => button.addEventListener("click", () => {
    document.querySelectorAll("[data-filter]").forEach(item => item.classList.remove("active"));
    button.classList.add("active");
    document.querySelectorAll(".table-row").forEach(row => {
      row.style.display = button.dataset.filter === "all" || row.dataset.status === button.dataset.filter ? "" : "none";
    });
  }));
}

document.querySelectorAll(".nav-item").forEach((item) => {
  item.addEventListener("click", (event) => {
    event.preventDefault();
    document.querySelectorAll(".nav-item").forEach((link) => link.classList.remove("active"));
    item.classList.add("active");
    const target = item.getAttribute("href");
    if (target === "#dashboard") content.innerHTML = dashboardTemplate;
    if (target === "#fields") renderFields();
    if (target === "#bookings") renderBookings();
    if (target === "#customers") renderCustomers();
    if (target === "#payments") renderPayments();
    if (target === "#dashboard") {
      document.querySelectorAll(".slot.available").forEach(slot =>
        slot.addEventListener("click", () => openDrawer(slot.dataset.field, slot.dataset.time))
      );
      document.getElementById("openBooking")?.addEventListener("click", () => openDrawer());
      const todayRevenue = document.getElementById("todayRevenue");
      if (todayRevenue) todayRevenue.textContent = formatSum(calculatePayments().todayRevenue);
    }
    if (window.innerWidth <= 760) closeDrawer();
  });
});

const globalSearch = document.querySelector(".search input");
globalSearch?.addEventListener("input", () => {
  const query = globalSearch.value.toLowerCase().trim();
  document.querySelectorAll("[data-search-row]").forEach((row) => {
    row.style.display = !query || row.textContent.toLowerCase().includes(query) ? "" : "none";
  });
});

const profileButton = document.getElementById("profileButton");
const roleMenu = document.getElementById("roleMenu");
const profileName = document.querySelector(".profile-copy strong");
const profileRole = document.querySelector(".profile-copy small");
const profileAvatar = document.querySelector(".avatar");

profileButton.addEventListener("click", (event) => {
  event.stopPropagation();
  roleMenu.classList.toggle("open");
  profileButton.setAttribute("aria-expanded", roleMenu.classList.contains("open"));
});

document.addEventListener("click", () => roleMenu.classList.remove("open"));
roleMenu.addEventListener("click", (event) => event.stopPropagation());

const roleViews = {
  captain: {
    name: "Sardor Aliyev",
    avatar: "SA",
    role: "Jamoa sardori",
    title: "Yulduzlar jamoasi",
    button: "Bron so‘rovini yuborish",
    html: `
      <section class="page-heading">
        <div><p class="eyebrow">23 noyabr, dushanba</p><h1>Maydon bron qilish</h1></div>
        <button class="primary-button" id="roleBooking"><svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>Yangi bron</button>
      </section>
      <section class="stats captain-stats">
        <article class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm1 15H4v-9h16v9Z"/></svg></div><div><p>Jami bronlar</p><strong>12</strong><small>bu oy</small></div></article>
        <article class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 11h5v-2h-5V6h-2v7h-4v2h6v-2Z"/></svg></div><div><p>Yaqin bron</p><strong>23 noyabr</strong><small>08:00–09:00</small></div></article>
        <article class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5-10-5Zm-8 8v6l8 4 8-4v-6l-8 4-8-4Z"/></svg></div><div><p>Jamoa</p><strong>Yulduzlar</strong><small>11 futbolchi</small></div></article>
      </section>
      <div class="policy-banner"><span>!</span><div><strong>Bron qoidalari</strong><p>Avans 2 soat ichida tushmasa bron bekor bo‘ladi. 24 soatdan kam qolgan bekor qilishda avans qaytarilmaydi.</p></div></div>
      <section class="role-grid">
        <article class="panel"><div class="panel-header"><div><h2>Bo‘sh vaqtlar</h2><p>23 noyabr uchun maydon jadvali</p></div></div><div class="mini-schedule">
          <div><span>08:00</span><button data-field="Maydon 1" data-time="08:00">Maydon 1 · Bron</button></div>
          <div><span>09:00</span><button class="busy" disabled>Maydon 1 · Band</button></div>
          <div><span>10:00</span><button data-field="Maydon 2" data-time="10:00">Maydon 2 · Bron</button></div>
          <div><span>11:00</span><button data-field="Maydon 3" data-time="11:00">Maydon 3 · Bron</button></div>
        </div></article>
        <article class="panel"><div class="panel-header"><div><h2>Mening bronlarim</h2><p>So‘nggi 3 ta</p></div></div><div class="request-list">
          <div class="request-row"><div><strong>Maydon 3</strong><p>23 noyabr · 08:00–09:00</p></div><button class="cancel-button" data-cancel data-hours="13">Bekor qilish</button></div>
          <div class="request-row"><div><strong>Doimiy bron</strong><p>Har seshanba · 20:00–21:00 · Maydon 2</p></div><span class="status paid">Faol</span></div>
          <div class="request-row"><div><strong>Maydon 1</strong><p>25 noyabr · 18:00–19:00</p></div><span class="status advance">Kutilmoqda</span></div>
          <div class="request-row"><div><strong>Maydon 2</strong><p>20 noyabr · 10:00–11:00</p></div><span class="status paid">Yakunlangan</span></div>
        </div></article>
      </section>`
  },
  admin: {
    name: "Aziza A.",
    avatar: "AA",
    role: "Administrator",
    title: "Maydon administratori",
    html: `
      <section class="page-heading"><div><p class="eyebrow">23 noyabr, dushanba</p><h1>Boshqaruv paneli</h1></div><button class="primary-button" id="roleBooking"><svg viewBox="0 0 24 24"><path d="M11 5h2v6h6v2h-6v6h-2v-6H5v-2h6V5Z"/></svg>Yangi bron</button></section>
      <section class="stats">
        <article class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24"><path d="M19 4h-1V2h-2v2H8V2H6v2H5a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3h14a3 3 0 0 0 3-3V7a3 3 0 0 0-3-3Zm1 15H4v-9h16v9Z"/></svg></div><div><p>Kutilayotganlar</p><strong id="pendingCount">5</strong><small class="positive">Yangi so‘rovlar</small></div></article>
        <article class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24"><path d="M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm1 11h5v-2h-5V6h-2v7h-4v2h6v-2Z"/></svg></div><div><p>Bugun</p><strong>24 bron</strong><small>6 tasdiqlangan</small></div></article>
        <article class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24"><path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-18 2h18v3H3V6Zm18 12H3v-7h18v7Z"/></svg></div><div><p>Avanslar</p><strong>3 250 000</strong><small>so‘m</small></div></article>
      </section>
      <section class="role-grid">
        <article class="panel"><div class="panel-header"><div><h2>Bron so‘rovlari</h2><p>Tasdiqlash uchun</p></div></div><div class="request-list">
          <div class="request-row"><div><strong>Yulduzlar FC</strong><p>Maydon 2 · 18:00–19:00 · Avans: 175 000</p></div><div class="row-actions"><button class="approve-button" data-action="approve">Tasdiqlash</button><button class="cancel-button" data-action="reject">Rad etish</button></div></div>
          <div class="request-row"><div><strong>Olmos jamoasi</strong><p>Maydon 1 · 20:00–21:00 · Avans: 200 000</p></div><div class="row-actions"><button class="approve-button" data-action="approve">Tasdiqlash</button><button class="cancel-button" data-action="reject">Rad etish</button></div></div>
          <div class="request-row" data-team-misses="2"><div><strong>Vortex team</strong><p>Maydon 3 · 14:00–15:00 · Kelmaganlar: <span class="miss-count">2</span>/3</p></div><div class="row-actions"><button class="approve-button" data-action="approve">Avans qayd</button><button class="cancel-button" data-action="no-show">Kelmadi</button></div></div>
        </div></article>
        <article class="panel"><div class="panel-header"><div><h2>Bugungi reja</h2><p>Maydonlar holati</p></div></div><div class="request-list">
          <div class="request-row"><div><strong>Maydon 1</strong><p>09:00 · Akmal Jo‘rayev</p></div><span class="status paid">Tasdiqlandi</span></div>
          <div class="request-row"><div><strong>Maydon 2</strong><p>10:00 · Azizbek Rahimov</p></div><span class="status advance">Avans</span></div>
          <div class="request-row"><div><strong>Maydon 3</strong><p>14:00 · Bo‘sh</p></div><span class="status open-status">Bo‘sh</span></div>
        </div></article>
      </section>`
  },
  owner: {
    name: "Bekzod K.",
    avatar: "BK",
    role: "Egasi",
    title: "Maydon egasi",
    html: `
      <section class="page-heading"><div><p class="eyebrow">23 noyabr, dushanba</p><h1>Statistika va sozlamalar</h1></div><button class="primary-button" id="openSettings">Sozlamalarni ochish</button></section>
      <section class="stats">
        <article class="stat-card"><div class="stat-icon green"><svg viewBox="0 0 24 24"><path d="M21 4H3a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h18a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2Zm-18 2h18v3H3V6Zm18 12H3v-7h18v7Z"/></svg></div><div><p>Haftalik tushum</p><strong>${formatSum(calculatePayments().weeklyRevenue)}</strong><small>so‘m · to‘lovlardan</small></div></article>
        <article class="stat-card"><div class="stat-icon blue"><svg viewBox="0 0 24 24"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2Z"/></svg></div><div><p>Bandlik foizi</p><strong>78%</strong><small>Jami 3 maydonda</small></div></article>
        <article class="stat-card"><div class="stat-icon orange"><svg viewBox="0 0 24 24"><path d="M12 2 2 7l10 5 10-5-10-5Zm-8 8v6l8 4 8-4v-6l-8 4-8-4Z"/></svg></div><div><p>Eng band soat</p><strong>18:00–19:00</strong><small>haftalik ko‘rsatkich</small></div></article>
      </section>
      <section class="role-grid owner-grid">
        <article class="panel"><div class="panel-header"><div><h2>Haftalik tushum</h2><p>17–23 noyabr</p></div></div><div class="bar-chart"><div><span>90%</span><i style="height:64%"></i><small>Du</small></div><div><span>68%</span><i style="height:48%"></i><small>Se</small></div><div><span>82%</span><i style="height:58%"></i><small>Ch</small></div><div><span>76%</span><i style="height:54%"></i><small>Pa</small></div><div><span>94%</span><i style="height:70%"></i><small>Ju</small></div><div><span>100%</span><i style="height:82%"></i><small>Sh</small></div><div><span>71%</span><i style="height:50%"></i><small>Ya</small></div></div></article>
        <article class="panel"><div class="panel-header"><div><h2>Maydon sozlamalari</h2><p>Soatbay narxlar</p></div></div><div class="settings-list">
          <div><div><strong>Maydon 1</strong><p>08:00–23:00</p></div><label><small>Kunduzi</small><input value="250 000" /></label><label><small>Kecha</small><input value="350 000" /></label></div>
          <div><div><strong>Maydon 2</strong><p>08:00–23:00</p></div><label><small>Kunduzi</small><input value="300 000" /></label><label><small>Kecha</small><input value="400 000" /></label></div>
          <div><div><strong>Maydon 3</strong><p>08:00–23:00</p></div><label><small>Kunduzi</small><input value="280 000" /></label><label><small>Kecha</small><input value="380 000" /></label></div>
        </div></article>
        <article class="panel heatmap-panel"><div class="panel-header"><div><h2>Bandlik issiqlik xaritasi</h2><p>Haftalik soat va kun bo‘yicha bandlik</p></div></div><div class="heatmap">
          <div class="heat-label"></div><div class="heat-label">Du</div><div class="heat-label">Se</div><div class="heat-label">Ch</div><div class="heat-label">Pa</div><div class="heat-label">Ju</div><div class="heat-label">Sh</div><div class="heat-label">Ya</div>
          <div class="heat-label">08:00</div><div class="heat-cell heat-low">20%</div><div class="heat-cell heat-low">25%</div><div class="heat-cell heat-medium">45%</div><div class="heat-cell heat-low">30%</div><div class="heat-cell heat-medium">50%</div><div class="heat-cell heat-high">65%</div><div class="heat-cell heat-low">25%</div>
          <div class="heat-label">12:00</div><div class="heat-cell heat-medium">55%</div><div class="heat-cell heat-low">35%</div><div class="heat-cell heat-medium">48%</div><div class="heat-cell heat-medium">58%</div><div class="heat-cell heat-high">70%</div><div class="heat-cell heat-peak">92%</div><div class="heat-cell heat-medium">50%</div>
          <div class="heat-label">16:00</div><div class="heat-cell heat-medium">60%</div><div class="heat-cell heat-high">75%</div><div class="heat-cell heat-high">68%</div><div class="heat-cell heat-high">72%</div><div class="heat-cell heat-peak">88%</div><div class="heat-cell heat-peak">95%</div><div class="heat-cell heat-high">78%</div>
          <div class="heat-label">20:00</div><div class="heat-cell heat-peak">90%</div><div class="heat-cell heat-peak">100%</div><div class="heat-cell heat-peak">96%</div><div class="heat-cell heat-peak">92%</div><div class="heat-cell heat-peak">100%</div><div class="heat-cell heat-peak">98%</div><div class="heat-cell heat-high">80%</div>
        </div></article>
      </section>`
  }
};

function switchRole(role) {
  const view = roleViews[role];
  content.innerHTML = view.html;
  profileName.textContent = view.name;
  profileRole.textContent = view.role;
  profileAvatar.textContent = view.avatar;
  roleMenu.querySelectorAll("button").forEach((button) =>
    button.classList.toggle("selected", button.dataset.role === role)
  );
  roleMenu.classList.remove("open");
  profileButton.setAttribute("aria-expanded", "false");
  bindRoleActions();
}

function bindRoleActions() {
  document.querySelectorAll("[data-field]").forEach((button) => {
    button.addEventListener("click", () => openDrawer(button.dataset.field, button.dataset.time));
  });
  document.querySelectorAll("[data-cancel]").forEach((button) => {
    button.addEventListener("click", () => {
      const hours = Number(button.dataset.hours || 24);
      if (hours < 24) {
        showToast("Bekor qilindi: avans 24 soat qoidasi bo‘yicha qaytarilmaydi");
      } else {
        showToast("Bron bekor qilindi");
      }
      button.closest(".request-row").remove();
    });
  });
  document.querySelectorAll("[data-action]").forEach((button) => {
    button.addEventListener("click", () => {
      const row = button.closest(".request-row");
      const action = button.dataset.action;
      row.querySelector(".row-actions")?.remove();
      if (action === "no-show") {
        const misses = Number(row.dataset.teamMisses || 0) + 1;
        row.dataset.teamMisses = String(misses);
        row.insertAdjacentHTML("beforeend", misses >= 3
          ? '<span class="status absent-status">Vaqtincha bloklandi</span>'
          : '<span class="status absent-status">Kelmadi</span>');
        showToast(misses >= 3 ? "Jamoa 3-marta kelmadi: vaqtincha bloklandi" : "Jamoa kelmadi deb belgilandi");
      } else {
        row.insertAdjacentHTML("beforeend", '<span class="status paid">Tasdiqlandi</span>');
        showToast("Bron tasdiqlandi");
      }
      const pending = document.getElementById("pendingCount");
      if (pending) pending.textContent = String(Math.max(0, Number(pending.textContent) - 1));
    });
  });
  document.getElementById("roleBooking")?.addEventListener("click", () => openDrawer());
  document.getElementById("openSettings")?.addEventListener("click", () =>
    document.querySelector(".owner-grid")?.scrollIntoView({ behavior: "smooth" })
  );
}

function showToast(message) {
  toast.querySelector("p").textContent = message;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

roleMenu.querySelectorAll("[data-role]").forEach((button) => {
  button.addEventListener("click", () => switchRole(button.dataset.role));
});

function openHashPage() {
  const routes = {
    "#dashboard": { render: () => { content.innerHTML = dashboardTemplate; }, label: "#dashboard" },
    "#fields": { render: renderFields, label: "#fields" },
    "#bookings": { render: renderBookings, label: "#bookings" },
    "#customers": { render: renderCustomers, label: "#customers" },
    "#payments": { render: renderPayments, label: "#payments" }
  };
  const route = routes[window.location.hash] || routes["#dashboard"];
  route.render();
  if (window.location.hash === "#dashboard" || !window.location.hash) {
    const totals = calculatePayments();
    const todayRevenue = document.getElementById("todayRevenue");
    if (todayRevenue) todayRevenue.textContent = formatSum(totals.todayRevenue);
  }
  document.querySelectorAll(".nav-item").forEach((link) =>
    link.classList.toggle("active", link.getAttribute("href") === route.label)
  );
  if (window.location.hash === "#dashboard") {
    document.querySelectorAll(".slot.available").forEach((slot) =>
      slot.addEventListener("click", () => openDrawer(slot.dataset.field, slot.dataset.time))
    );
    document.getElementById("openBooking")?.addEventListener("click", () => openDrawer());
  }
}

window.addEventListener("hashchange", openHashPage);
openHashPage();
