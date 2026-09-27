/* =========================================================
   ECOPICKUP - script.js v2.0
   Enhanced with: Hero Particles, Notification Bell, FAB Dock,
   Community Challenges, Live City Feed, Achievement Badges,
   City Map Canvas, Fleet Tracker, Cursor Glow, Scroll Progress
   ========================================================= */

const CATEGORIES = [
  { key: "recycle",  icon: "♻️", label: "Recyclables", bin: "Blue Bin" },
  { key: "organic",  icon: "🍌", label: "Food / Organic", bin: "Green Bin" },
  { key: "ewaste",   icon: "🔌", label: "E-Waste", bin: "Grey Bin" },
  { key: "hazard",   icon: "☣️", label: "Hazardous", bin: "Red Bin" },
  { key: "bulky",    icon: "🛋️", label: "Bulky Items", bin: "On-Demand" },
  { key: "general",  icon: "🗑️", label: "General Waste", bin: "Black Bin" },
];

const ADMIN_CODE = "1234";

let draft = { category: "recycle", name: "", phone: "", address: "", date: "", slot: "" };
let issueDraft = { type: "Missed Pickup" };
let lastTicketId = "";
let userPoints = 520;
let fabOpen = false;
let notifOpen = false;
let cityMapAnimFrame = null;
let particleAnimFrame = null;

/* =========================================================
   SYNTHESIZER SOUND ENGINE (Web Audio API)
   ========================================================= */
const soundEngine = {
  ctx: null,
  init() {
    if (!this.ctx && (window.AudioContext || window.webkitAudioContext)) {
      this.ctx = new (window.AudioContext || window.webkitAudioContext)();
    }
  },
  play(freq, type = "sine", duration = 0.15, vol = 0.14) {
    if (localStorage.getItem("ecoSound") === "off") return;
    try {
      this.init();
      if (!this.ctx) return;
      if (this.ctx.state === "suspended") this.ctx.resume();
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, this.ctx.currentTime);
      gain.gain.setValueAtTime(vol, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + duration);
      osc.connect(gain);
      gain.connect(this.ctx.destination);
      osc.start();
      osc.stop(this.ctx.currentTime + duration);
    } catch(e) {}
  },
  pop() { this.play(540, "triangle", 0.08, 0.12); },
  success() {
    this.play(523.25, "sine", 0.1, 0.12);
    setTimeout(() => this.play(659.25, "sine", 0.1, 0.12), 70);
    setTimeout(() => this.play(783.99, "sine", 0.14, 0.13), 140);
    setTimeout(() => this.play(1046.50, "sine", 0.22, 0.15), 210);
  },
  error() {
    this.play(260, "sawtooth", 0.12, 0.12);
    setTimeout(() => this.play(200, "sawtooth", 0.16, 0.12), 100);
  },
  fanfare() {
    [523, 659, 783, 1046, 1318].forEach((f, i) => {
      setTimeout(() => this.play(f, "triangle", 0.18, 0.14), i * 80);
    });
  }
};

function toggleSound() {
  const current = localStorage.getItem("ecoSound") || "on";
  const next = current === "on" ? "off" : "on";
  localStorage.setItem("ecoSound", next);
  const btn = document.getElementById("sound-toggle");
  if (btn) {
    btn.textContent = next === "on" ? "🔊" : "🔇";
    btn.classList.toggle("muted", next === "off");
  }
  if (next === "on") soundEngine.pop();
  showToast(`Sound effects ${next === "on" ? "Enabled 🔊" : "Muted 🔇"}`);
}

/* =========================================================
   FLOATING ECOPOINTS REWARD BUBBLES
   ========================================================= */
function spawnPointBubble(text = "+25 EcoPoints! ✨", x, y) {
  const pill = document.createElement("div");
  pill.className = "floating-point-pill";
  pill.textContent = text;
  pill.style.left = (x !== undefined ? x : (window.innerWidth / 2 - 80)) + "px";
  pill.style.top = (y !== undefined ? y : (window.innerHeight / 2 - 30)) + "px";
  document.body.appendChild(pill);
  setTimeout(() => pill.remove(), 1400);
}

/* =========================================================
   TYPEWRITER SUBTITLE ENGINE
   ========================================================= */
const TYPEWRITER_PHRASES = [
  "Made Effortless.",
  "100% Zero-Landfill.",
  "Clean & Circular.",
  "Rewarding Your Community.",
  "Powered by Electric Fleets."
];
let typewriterIdx = 0;
let charIdx = 0;
let isDeleting = false;
let typewriterTimer = null;

function tickTypewriter() {
  const el = document.getElementById("typewriter-text");
  if (!el) return;
  const current = TYPEWRITER_PHRASES[typewriterIdx];
  if (isDeleting) {
    charIdx--;
    el.textContent = current.substring(0, charIdx);
    if (charIdx <= 0) {
      isDeleting = false;
      typewriterIdx = (typewriterIdx + 1) % TYPEWRITER_PHRASES.length;
      typewriterTimer = setTimeout(tickTypewriter, 320);
      return;
    }
    typewriterTimer = setTimeout(tickTypewriter, 40);
  } else {
    charIdx++;
    el.textContent = current.substring(0, charIdx);
    if (charIdx >= current.length) {
      isDeleting = true;
      typewriterTimer = setTimeout(tickTypewriter, 2600);
      return;
    }
    typewriterTimer = setTimeout(tickTypewriter, 85);
  }
}

/* =========================================================
   TOAST NOTIFICATION ENGINE
   ========================================================= */
function showToast(msg, icon = "✅") {
  const box = document.getElementById("toast-box");
  if (!box) return;
  const t = document.createElement("div");
  t.className = "toast";
  t.innerHTML = `<span>${icon}</span><span>${msg}</span>`;
  box.appendChild(t);
  setTimeout(() => {
    t.style.opacity = "0";
    t.style.transform = "translateX(100%)";
    t.style.transition = "all 0.3s ease";
    setTimeout(() => t.remove(), 300);
  }, 3200);
}

/* =========================================================
   NAVIGATION & ACTIVE STATES
   ========================================================= */
function goTo(screenId){
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if(target) target.classList.add("active");
  window.scrollTo({ top: 0, behavior: "smooth" });

  document.querySelectorAll(".nav-link").forEach(btn => {
    btn.classList.toggle("active", btn.getAttribute("data-screen") === screenId);
  });

  const mobNav = document.getElementById("mobile-nav");
  if(mobNav) mobNav.classList.remove("open");

  if(screenId === "screen-home"){ renderHomeStats(); renderHomeCategories(); renderFAQ(); renderChallenges(); renderCityFeed(); observeReveals(); }
  if(screenId === "screen-track") renderTrack();
  if(screenId === "screen-learn") { renderLearn(); setTimeout(renderRadarBins, 200); }
  if(screenId === "screen-newreq-1") renderCategoryGrid();
  if(screenId === "screen-success") launchConfetti();
  if(screenId === "screen-rewards") { renderRewardsCatalog(); renderBadges(); }
  if(screenId === "screen-calc") updateImpactCalc();
  if(screenId === "screen-citymap") { setTimeout(initCityMap, 100); renderFleetGrid(); renderZoneStats(); }
}

function mobileGo(id){ goTo(id); }
function toggleMobileNav(){ 
  const mob = document.getElementById("mobile-nav");
  if(mob) mob.classList.toggle("open"); 
}

/* =========================================================
   DARK / LIGHT THEME
   ========================================================= */
function applyTheme(theme){
  document.body.setAttribute("data-theme", theme);
  const toggleBtn = document.getElementById("theme-toggle");
  if(toggleBtn) toggleBtn.textContent = theme === "dark" ? "☀️" : "🌙";
  localStorage.setItem("ecoTheme", theme);
}

function toggleTheme(){
  const current = document.body.getAttribute("data-theme") === "dark" ? "dark" : "light";
  const next = current === "dark" ? "light" : "dark";
  applyTheme(next);
  showToast(`Switched to ${next} theme`, next === "dark" ? "🌙" : "☀️");
}

/* =========================================================
   NOTIFICATION BELL SYSTEM
   ========================================================= */
const NOTIFS = [
  { icon: "🚚", title: "Driver En Route!", detail: "Electric van EV-07 dispatched to Sector 4 pickup.", time: "2 min ago", unread: true },
  { icon: "✅", title: "Pickup Completed", detail: "WP-5192 — 18kg recyclables collected and verified.", time: "1 hr ago", unread: true },
  { icon: "🏆", title: "Badge Unlocked!", detail: "You earned the 'Recycling Champion' achievement badge!", time: "3 hrs ago", unread: false },
  { icon: "🌱", title: "Weekly Challenge", detail: "Sector 4 is 73% toward completing the 500kg challenge!", time: "5 hrs ago", unread: false },
  { icon: "🎁", title: "Bonus EcoPoints", detail: "+100 bonus points for segregating 5 batches this week.", time: "1 day ago", unread: false },
];

function renderNotifList(){
  const list = document.getElementById("notif-list");
  if(!list) return;
  list.innerHTML = NOTIFS.map(n => `
    <div class="notif-item ${n.unread ? 'unread' : ''}">
      <div class="notif-item-icon">${n.icon}</div>
      <div class="notif-item-text">
        <div class="notif-item-title">${n.title}</div>
        <div class="notif-item-time">${n.detail}</div>
        <div class="notif-item-time">${n.time}</div>
      </div>
    </div>
  `).join("");
}

function toggleNotifPanel(){
  const panel = document.getElementById("notif-panel");
  if(!panel) return;
  notifOpen = !notifOpen;
  panel.classList.toggle("open", notifOpen);
  if(notifOpen) renderNotifList();
}

function clearNotifs(){
  NOTIFS.forEach(n => n.unread = false);
  const dot = document.getElementById("notif-dot");
  if(dot) dot.classList.remove("visible");
  renderNotifList();
}

function initNotifDot(){
  const dot = document.getElementById("notif-dot");
  if(dot && NOTIFS.some(n => n.unread)) dot.classList.add("visible");
}

// Close notif panel on outside click
document.addEventListener("click", (e) => {
  if(notifOpen && !e.target.closest(".notif-bell") && !e.target.closest(".notif-panel")){
    notifOpen = false;
    const panel = document.getElementById("notif-panel");
    if(panel) panel.classList.remove("open");
  }
});

/* =========================================================
   FLOATING ACTION BUTTON DOCK
   ========================================================= */
function toggleFab(){
  fabOpen = !fabOpen;
  const dock = document.getElementById("fab-dock");
  if(dock) dock.classList.toggle("open", fabOpen);
}

function closeFab(){
  fabOpen = false;
  const dock = document.getElementById("fab-dock");
  if(dock) dock.classList.remove("open");
}

/* =========================================================
   STORAGE HELPERS WITH REALISTIC SEED DATA
   ========================================================= */
function loadRequests(){
  try {
    let list = JSON.parse(localStorage.getItem("wasteRequests") || "null");
    if (!list || !list.length) {
      list = [
        {
          id: "WP-8241", category: "ewaste", name: "Arjun Patel", phone: "+1 (555) 345-9821",
          address: "74 Tech Park Blvd, Sector 3", date: "2026-09-28", slot: "Morning", status: "Scheduled",
          createdAt: new Date().toISOString(), history: [{ status: "Pending", at: new Date().toISOString() }, { status: "Scheduled", at: new Date().toISOString() }]
        },
        {
          id: "WP-5192", category: "recycle", name: "Elena Rostova", phone: "+1 (555) 890-4321",
          address: "12 Harbour Promenade, Flat 8C", date: "2026-09-27", slot: "Afternoon", status: "Collected",
          createdAt: new Date(Date.now() - 86400000).toISOString(), history: [{ status: "Collected", at: new Date().toISOString() }]
        },
        {
          id: "WP-3810", category: "organic", name: "Meera Sundaram", phone: "+1 (555) 678-1234",
          address: "45 Green Meadows Ave, Sector 4", date: "2026-09-29", slot: "Morning", status: "Pending",
          createdAt: new Date(Date.now() - 3600000 * 2).toISOString(), history: [{ status: "Pending", at: new Date().toISOString() }]
        }
      ];
      localStorage.setItem("wasteRequests", JSON.stringify(list));
    }
    return list;
  } catch(e) {
    return [];
  }
}

function saveRequests(list){ localStorage.setItem("wasteRequests", JSON.stringify(list)); }

function loadIssues(){
  try {
    let list = JSON.parse(localStorage.getItem("wasteIssues") || "null");
    if (!list || !list.length) {
      list = [
        {
          id: "IS-1042", name: "Marcus Vance", type: "Overflowing Bin",
          location: "Downtown Metro Station Exit B", desc: "Plastic bottles spilling onto sidewalk.",
          status: "Open", createdAt: new Date().toISOString()
        }
      ];
      localStorage.setItem("wasteIssues", JSON.stringify(list));
    }
    return list;
  } catch(e) {
    return [];
  }
}

function saveIssues(list){ localStorage.setItem("wasteIssues", JSON.stringify(list)); }

function genId(prefix){ return prefix + "-" + Math.floor(1000 + Math.random()*9000); }
function categoryLabel(key){
  const c = CATEGORIES.find(c => c.key === key);
  return c ? c.icon + " " + c.label : key;
}

/* =========================================================
   HOME PAGE: Stats, Categories, FAQ, Challenges, Feed
   ========================================================= */
function renderHomeStats(){
  const list = loadRequests();
  const collected = list.filter(r => r.status === "Collected").length;
  const stats = [
    { num: list.length, lbl: "Requests Logged", icon: "📦" },
    { num: collected, lbl: "Pickups Completed", icon: "✅" },
    { num: CATEGORIES.length, lbl: "Waste Streams", icon: "♻️" },
    { num: 24, lbl: "Hrs Avg. Response", icon: "⚡" },
  ];
  const el = document.getElementById("home-stats");
  if (!el) return;

  el.innerHTML = stats.map(s => `
    <div class="stat-tile">
      <div style="font-size:28px; margin-bottom:6px;">${s.icon}</div>
      <div class="num" data-target="${s.num}">0</div>
      <div class="lbl">${s.lbl}</div>
    </div>
  `).join("");

  el.querySelectorAll(".num").forEach(numEl => {
    const target = parseInt(numEl.dataset.target, 10);
    let current = 0;
    const step = Math.max(1, Math.ceil(target / 25));
    const timer = setInterval(() => {
      current += step;
      if(current >= target){ current = target; clearInterval(timer); }
      numEl.textContent = current;
    }, 28);
  });
}

function renderHomeCategories(){
  const grid = document.getElementById("home-cat-grid");
  if (!grid) return;
  grid.innerHTML = CATEGORIES.map(c => `
    <div class="cat-tile" onclick="quickStart('${c.key}')">
      <span class="ic">${c.icon}</span>
      <span>${c.label}</span>
    </div>
  `).join("");
}

function quickStart(key){
  draft.category = key;
  goTo("screen-newreq-1");
  showToast(`Selected ${categoryLabel(key)}`);
}

/* Community Weekly Challenges */
const CHALLENGES = [
  {
    icon: "♻️", title: "500kg Sector Recycle Drive",
    desc: "Collectively recycle 500kg of dry waste from Sector 4 this week.",
    progress: 73, total: 100, pts: "+200 pts each", type: "ch-green",
    joined: true
  },
  {
    icon: "🌱", title: "Zero Food Waste Friday",
    desc: "Report zero food scraps going to landfill this Friday with photo proof.",
    progress: 48, total: 100, pts: "+150 pts each", type: "ch-blue",
    joined: false
  },
  {
    icon: "🔌", title: "E-Waste Collection Week",
    desc: "Drop off or schedule 3+ e-waste items for certified safe recycling.",
    progress: 62, total: 100, pts: "+300 pts each", type: "ch-amber",
    joined: false
  }
];

function renderChallenges(){
  const grid = document.getElementById("challenges-grid");
  if(!grid) return;
  grid.innerHTML = CHALLENGES.map((c, i) => `
    <div class="challenge-card ${c.type} reveal">
      <div class="ch-icon">${c.icon}</div>
      <div class="ch-title">${c.title}</div>
      <div class="ch-desc">${c.desc}</div>
      <div class="ch-progress-bar">
        <div class="ch-progress-fill" id="ch-fill-${i}" style="width:0%"></div>
      </div>
      <div class="ch-meta">
        <span>${c.progress}% complete</span>
        <span class="ch-pts">${c.pts}</span>
      </div>
      <button class="ch-join-btn" onclick="joinChallenge(${i}, this)">
        ${c.joined ? "✅ Joined" : "⚡ Join Challenge"}
      </button>
    </div>
  `).join("");

  // Animate progress bars
  setTimeout(() => {
    CHALLENGES.forEach((c, i) => {
      const fill = document.getElementById("ch-fill-" + i);
      if(fill) fill.style.width = c.progress + "%";
    });
  }, 200);
}

function joinChallenge(idx, btn){
  CHALLENGES[idx].joined = !CHALLENGES[idx].joined;
  btn.textContent = CHALLENGES[idx].joined ? "✅ Joined" : "⚡ Join Challenge";
  if(CHALLENGES[idx].joined){
    soundEngine.success();
    spawnPointBubble("+150 EcoPoints Goal! ⚡");
    showToast(`Joined: ${CHALLENGES[idx].title}`, "⚡");
    addNotification("🌱", "Challenge Joined!", `You joined "${CHALLENGES[idx].title}"`, "Just now");
  } else {
    soundEngine.pop();
  }
}

function addNotification(icon, title, detail, time){
  NOTIFS.unshift({ icon, title, detail, time, unread: true });
  const dot = document.getElementById("notif-dot");
  if(dot) dot.classList.add("visible");
}

/* Live City Feed */
const FEED_EVENTS = [
  { icon: "🚚", title: "Electric Van EV-07 dispatched", detail: "En route to Sector 4 • Recyclables pickup • Driver: Rahul S.", time: "2 min ago", badge: "Live" },
  { icon: "✅", title: "Pickup completed — WP-5192", detail: "Elena Rostova • 18 kg recyclables • Harbour Promenade", time: "42 min ago", badge: "+50 pts" },
  { icon: "♻️", title: "Recycling center weigh-in", detail: "Batch #B-4421 processed — 234kg diverted from landfill", time: "1 hr ago", badge: "Certified" },
  { icon: "⚠️", title: "Overflow alert resolved", detail: "Downtown Metro Bin cleared by EV-03 crew", time: "2 hrs ago", badge: "Resolved" },
  { icon: "🌱", title: "Compost batch delivered", detail: "42 kg organic scraps sent to Green Meadows Biogas Plant", time: "3 hrs ago", badge: "+30 pts" },
  { icon: "🔌", title: "E-waste lot processed", detail: "23 devices certified for rare-earth mineral recovery", time: "4 hrs ago", badge: "Certified" },
];

let feedEventIndex = 0;

function renderCityFeed(){
  const feed = document.getElementById("city-feed");
  if(!feed) return;
  feed.innerHTML = FEED_EVENTS.map((e, i) => `
    <div class="feed-item" style="animation-delay: ${i * 0.08}s">
      <div class="feed-icon">${e.icon}</div>
      <div class="feed-content">
        <div class="feed-title">${e.title}</div>
        <div class="feed-detail">${e.detail}</div>
        <div class="feed-time">${e.time}</div>
      </div>
      <div class="feed-badge">${e.badge}</div>
    </div>
  `).join("");
}

/* FAQ */
const FAQS = [
  { q: "How do I request a waste pickup?", a: "Simply tap 'Request Pickup', choose your waste category, specify your address and select your preferred date & time slot. Our electric collection team handles the rest." },
  { q: "How can I track my pickup status in real time?", a: "Visit the 'Track Status' page and search by your Pickup Number (e.g. WP-8241) or your Name to check collection milestones." },
  { q: "What should I do if my collection is delayed or a public bin is overflowing?", a: "Use the 'Report Issue' page to submit a direct notification with the location. Our municipal dispatch crew will be notified immediately." },
  { q: "Is there any cost for residential recycling collections?", a: "Standard residential recyclable streams, e-waste, and compost pickups are 100% free of charge as part of the municipal green city program." },
  { q: "How does the EcoRewards program work?", a: "You earn EcoPoints for every verified pickup. Points can be redeemed for municipal discounts, public transport vouchers, tree plantings, or city utility credits." },
  { q: "Can I see live city-wide waste operations?", a: "Yes! Visit the '🗺️ City Map' page to see real-time electric fleet positions, smart bin fill levels, and collection zones on the live operations map." },
];

function renderFAQ(){
  const el = document.getElementById("faq-list");
  if (!el) return;
  el.innerHTML = FAQS.map((f,i) => `
    <div class="faq-item" id="faq-${i}">
      <div class="faq-q" onclick="toggleFAQ(${i})">
        <span>${f.q}</span>
        <span class="faq-arrow">▾</span>
      </div>
      <div class="faq-a">${f.a}</div>
    </div>
  `).join("");
}

function toggleFAQ(i){
  const item = document.getElementById("faq-" + i);
  if(item) item.classList.toggle("open");
}

function observeReveals(){
  const els = document.querySelectorAll(".reveal");
  const obs = new IntersectionObserver(entries => {
    entries.forEach(e => { if(e.isIntersecting) e.target.classList.add("visible"); });
  }, { threshold: 0.12 });
  els.forEach(el => obs.observe(el));
}

/* =========================================================
   REQUEST WIZARD
   ========================================================= */
function renderCategoryGrid(){
  const grid = document.getElementById("cat-grid");
  if (!grid) return;
  grid.innerHTML = "";
  CATEGORIES.forEach(cat => {
    const card = document.createElement("div");
    card.className = "cat-card" + (draft.category === cat.key ? " selected" : "");
    card.innerHTML = `<span class="cat-icon">${cat.icon}</span><span>${cat.label}</span><small style="display:block; font-size:11px; color:var(--muted); margin-top:4px;">${cat.bin}</small>`;
    card.onclick = () => {
      draft.category = cat.key;
      renderCategoryGrid();
      setTimeout(() => goTo("screen-newreq-2"), 220);
    };
    grid.appendChild(card);
  });
}

function setWeight(label, btn){
  document.querySelectorAll(".wp-pill").forEach(b => b.classList.remove("active"));
  btn.classList.add("active");
  draft.weight = label;
}

function autoFillAddress(){
  const nameInput = document.getElementById("in-name");
  const phoneInput = document.getElementById("in-phone");
  const addrInput = document.getElementById("in-address");

  if(nameInput && !nameInput.value) nameInput.value = "Sarah Connor";
  if(phoneInput && !phoneInput.value) phoneInput.value = "+1 (555) 234-5678";
  if(addrInput) addrInput.value = "Veridian Green Way #412, Apt 8B, Sector 4";
  showToast("📍 Auto-filled demo address", "📍");
}

function goToStep3(){
  draft.name = (document.getElementById("in-name").value || "").trim();
  draft.phone = (document.getElementById("in-phone").value || "").trim();
  draft.address = (document.getElementById("in-address").value || "").trim();

  if(!draft.name || !draft.address){
    alert("Please enter both your full name and pickup address.");
    return;
  }
  goTo("screen-newreq-3");
}

function pickSlot(btn, slot){
  document.querySelectorAll("#screen-newreq-3 .slot-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  draft.slot = slot;
}

function goToStep4(){
  draft.date = document.getElementById("in-date").value;
  if(!draft.date){ alert("Please pick a pickup date."); return; }
  if(!draft.slot){ alert("Please select an arrival window."); return; }
  renderSummary();
  goTo("screen-newreq-4");
}

function renderSummary(){
  const el = document.getElementById("summary-card");
  if(!el) return;
  el.innerHTML = `
    <div class="summary-row"><b>Waste Type:</b> <span>${categoryLabel(draft.category)}</span></div>
    <div class="summary-row"><b>Name:</b> <span>${draft.name}</span></div>
    <div class="summary-row"><b>Phone:</b> <span>${draft.phone || "Not specified"}</span></div>
    <div class="summary-row"><b>Address:</b> <span>${draft.address}</span></div>
    <div class="summary-row"><b>Date:</b> <span>${draft.date}</span></div>
    <div class="summary-row"><b>Window:</b> <span>${draft.slot}</span></div>
    <div class="summary-row"><b>Est. Weight:</b> <span>${draft.weight || "Small (~1-5 kg)"}</span></div>
    <div class="summary-row"><b>Est. EcoPoints:</b> <span style="color:var(--green-mid); font-weight:800;">+50 pts upon collection</span></div>
  `;
}

function submitRequest(){
  const id = genId("WP");
  const req = {
    id, category: draft.category, name: draft.name, phone: draft.phone, address: draft.address,
    date: draft.date, slot: draft.slot, status: "Pending",
    createdAt: new Date().toISOString(), history: [{ status: "Pending", at: new Date().toISOString() }]
  };
  const list = loadRequests();
  list.unshift(req);
  saveRequests(list);
  lastTicketId = id;

  document.getElementById("ticket-id-display").textContent = id;

  // Add notification
  addNotification("🚚", "Pickup Scheduled!", `${categoryLabel(draft.category)} pickup confirmed. Ticket: ${id}`, "Just now");

  draft = { category: "recycle", name: "", phone: "", address: "", date: "", slot: "" };
  if(document.getElementById("in-name")) document.getElementById("in-name").value = "";
  if(document.getElementById("in-phone")) document.getElementById("in-phone").value = "";
  if(document.getElementById("in-address")) document.getElementById("in-address").value = "";
  if(document.getElementById("in-date")) document.getElementById("in-date").value = "";

  soundEngine.fanfare();
  spawnPointBubble("+50 EcoPoints! 🎁");
  showToast(`🎉 Pickup confirmed! Ticket: ${id}`);
  goTo("screen-success");
}

function copyTicketId(){
  navigator.clipboard.writeText(lastTicketId).then(() => {
    showToast(`Copied ${lastTicketId} to clipboard!`);
  }).catch(() => {
    showToast(`Ticket: ${lastTicketId}`);
  });
}

function searchTicketDirectly(){
  const searchInput = document.getElementById("track-search");
  if(searchInput && lastTicketId){
    searchInput.value = lastTicketId;
    renderTrack();
  }
}

/* =========================================================
   TRACK SCREEN
   ========================================================= */
function quickFillTrack(ticketId){
  const input = document.getElementById("track-search");
  if(input){
    input.value = ticketId;
    renderTrack();
  }
}

function reqCardHTML(r){
  const milestones = [
    { key: "Pending", icon: "📋", label: "Request Received" },
    { key: "Scheduled", icon: "📅", label: "Driver Scheduled" },
    { key: "Collected", icon: "✅", label: "Collected & Verified" },
  ];
  const statusOrder = ["Pending","Scheduled","Collected","Cancelled"];
  const currentIdx = statusOrder.indexOf(r.status);

  return `
  <div class="req-card">
    <div class="req-top-row">
      <span class="req-id">${r.id}</span>
      <span class="status-badge status-${r.status}">${r.status}</span>
    </div>
    <div class="req-line"><strong>${categoryLabel(r.category)}</strong></div>
    <div class="req-line">👤 ${r.name} ${r.phone ? "· 📞 " + r.phone : ""}</div>
    <div class="req-line">📅 ${r.date || "Scheduled"} · ${r.slot || "Anytime"}</div>
    <div class="req-line">📍 ${r.address}</div>
    ${(r.status === "Pending" || r.status === "Scheduled") ? `
    <div style="margin-top:14px; display:flex; justify-content:flex-end;">
      <button class="btn-sim-trip" onclick="simulateGpsTrip('${r.id}')">
        <span>⚡</span><span>Simulate Driver En Route</span>
      </button>
    </div>
    <div id="trip-panel-${r.id}"></div>` : ''}
    ${r.status !== "Cancelled" ? `
    <div class="milestone-track" style="margin-top:14px; padding-top:12px; border-top:1px solid var(--border);">
      <div style="display:flex; gap:0; align-items:center;">
        ${milestones.map((m, i) => `
          <div style="flex:1; text-align:center; position:relative;">
            <div style="
              width:32px; height:32px;
              border-radius:50%;
              background: ${i <= currentIdx ? 'var(--green)' : 'var(--border)'};
              color: ${i <= currentIdx ? '#fff' : 'var(--muted)'};
              display:flex; align-items:center; justify-content:center;
              margin: 0 auto 6px;
              font-size:14px;
              transition: all 0.3s;
            ">${m.icon}</div>
            <div style="font-size:10px; font-weight:700; color:${i <= currentIdx ? 'var(--green-mid)' : 'var(--muted)'};">${m.label}</div>
            ${i < milestones.length - 1 ? `
              <div style="
                position:absolute; top:15px; left:50%; width:100%;
                height:2px; background: ${i < currentIdx ? 'var(--green)' : 'var(--border)'};
                z-index:-1;
              "></div>` : ''}
          </div>
        `).join("")}
      </div>
    </div>` : ''}
  </div>`;
}

function renderTrack(){
  const q = (document.getElementById("track-search").value || "").trim().toLowerCase();
  const el = document.getElementById("track-results");
  if (!el) return;

  const list = loadRequests();

  if(!q){
    el.innerHTML = list.slice(0, 3).map(reqCardHTML).join("");
    return;
  }

  const filtered = list.filter(r => 
    r.name.toLowerCase().includes(q) || 
    r.id.toLowerCase().includes(q) || 
    r.address.toLowerCase().includes(q)
  );

  el.innerHTML = filtered.length ? filtered.map(reqCardHTML).join("") : `
    <div class="empty-msg">
      <span style="font-size:32px; display:block; margin-bottom:8px;">🔍</span>
      No request found matching "<strong>${q}</strong>". Check the ticket spelling.
    </div>`;
}

/* =========================================================
   IMPACT CALCULATOR
   ========================================================= */
function updateImpactCalc(){
  const plastic = +document.getElementById("range-plastic").value;
  const organic = +document.getElementById("range-organic").value;
  const paper   = +document.getElementById("range-paper").value;
  const ewaste  = +document.getElementById("range-ewaste").value;

  document.getElementById("val-plastic").textContent = plastic + " kg";
  document.getElementById("val-organic").textContent = organic + " kg";
  document.getElementById("val-paper").textContent   = paper + " kg";
  document.getElementById("val-ewaste").textContent  = ewaste + " items";

  const co2 = Math.round((plastic * 2.5 + organic * 0.9 + paper * 1.1 + ewaste * 12) * 12);
  const trees = (co2 / 21.77).toFixed(1);
  const water = Math.round(plastic * 12 + paper * 10 + ewaste * 35) * 12;
  const energy = Math.round(plastic * 1.2 + organic * 0.3 + paper * 0.8 + ewaste * 8) * 12;
  const pts = Math.round((plastic + organic + paper) * 3 + ewaste * 15) * 12;

  document.getElementById("calc-co2").textContent = co2.toLocaleString();
  document.getElementById("calc-trees").textContent = trees;
  document.getElementById("calc-water").textContent = water.toLocaleString() + " L";
  document.getElementById("calc-energy").textContent = energy.toLocaleString() + " kWh";
  document.getElementById("calc-pts").textContent = pts.toLocaleString() + " pts";
}

/* =========================================================
   ECOREWARDS, BADGES & CATALOG
   ========================================================= */
const BADGES = [
  { icon: "🌱", name: "First Segregation", desc: "Completed first waste separation", unlocked: true },
  { icon: "♻️", name: "Recycling Hero", desc: "Recycled 50+ kg in a month", unlocked: true },
  { icon: "🔥", name: "7-Day Streak", desc: "Active for 7 consecutive days", unlocked: true },
  { icon: "⚡", name: "E-Waste Champion", desc: "Responsibly disposed 10 e-waste items", unlocked: false },
  { icon: "🌊", name: "Water Saver", desc: "Conserved 1000L via recycling", unlocked: false },
  { icon: "🏆", name: "Community Legend", desc: "Top 10 in neighborhood leaderboard", unlocked: false },
  { icon: "🌍", name: "Carbon Cutter", desc: "Prevented 500kg of CO2 emissions", unlocked: false },
  { icon: "🎯", name: "Perfect Sorter", desc: "100% accuracy in quiz challenges", unlocked: false },
  { icon: "💎", name: "Diamond Citizen", desc: "Reached 5000 lifetime EcoPoints", unlocked: false },
  { icon: "🌲", name: "Tree Planter", desc: "Contributed to 10 tree plantings", unlocked: true },
];

function renderBadges(){
  const grid = document.getElementById("badges-grid");
  if(!grid) return;
  grid.innerHTML = BADGES.map((b, i) => `
    <div class="badge-card ${b.unlocked ? 'unlocked' : 'locked'}" title="${b.desc}">
      ${b.unlocked ? '<span class="badge-unlocked-seal">✅</span>' : ''}
      <span class="badge-card-icon">${b.icon}</span>
      <div class="badge-card-name">${b.name}</div>
      <div class="badge-card-desc">${b.desc}</div>
    </div>
  `).join("");
}

const REWARDS_CATALOG = [
  { icon: "🌳", title: "Plant a Tree", desc: "Fund planting in your city's green belt", pts: 200, code: "ECO-TREE" },
  { icon: "🚌", title: "Free Bus Pass", desc: "1-day unlimited public transport", pts: 350, code: "ECO-BUS" },
  { icon: "🛒", title: "Grocery Voucher", desc: "₹200 off at partner eco-stores", pts: 300, code: "ECO-GROC" },
  { icon: "⚡", title: "Electricity Credit", desc: "₹150 credit on utility bill", pts: 450, code: "ECO-UTIL" },
  { icon: "🎬", title: "Cinema Ticket", desc: "1 free movie ticket at GreenPlex", pts: 500, code: "ECO-CINE" },
  { icon: "📚", title: "EcoBook Bundle", desc: "3 sustainability books delivered", pts: 250, code: "ECO-READ" },
  { icon: "🍃", title: "Organic Hamper", desc: "Monthly organic produce basket", pts: 600, code: "ECO-HAMPER" },
  { icon: "☀️", title: "Solar Panel Audit", desc: "Free home solar feasibility report", pts: 800, code: "ECO-SOLAR" },
];

function renderRewardsCatalog(){
  const el = document.getElementById("rewards-catalog-list");
  if(!el) return;
  el.innerHTML = REWARDS_CATALOG.map(r => `
    <div class="reward-item-card">
      <div class="ri-icon">${r.icon}</div>
      <div class="ri-title">${r.title}</div>
      <div class="ri-desc">${r.desc}</div>
      <div class="ri-pts">🎁 ${r.pts} EcoPoints</div>
      <button class="btn-redeem" onclick="redeemReward('${r.code}', ${r.pts}, '${r.title}')">
        ${userPoints >= r.pts ? "✅ Redeem Now" : "🔒 " + r.pts + " pts needed"}
      </button>
    </div>
  `).join("");
}

function redeemReward(code, pts, title){
  if(userPoints < pts){
    showToast(`Need ${pts - userPoints} more EcoPoints to redeem!`, "⚠️");
    return;
  }
  userPoints -= pts;
  updatePointsDisplay();
  const modal = document.getElementById("voucher-modal");
  const body = document.getElementById("voucher-modal-body");
  if(modal && body){
    body.innerHTML = `
      <div style="font-size:60px; margin-bottom:16px;">${REWARDS_CATALOG.find(r=>r.code===code)?.icon || "🎁"}</div>
      <h2 style="margin-bottom:8px;">${title}</h2>
      <p style="color:var(--muted); margin-bottom:20px;">Your reward has been issued!</p>
      <div class="v-code-badge">${code}</div>
      <p style="font-size:13px; color:var(--muted); margin-top:12px;">Show this code at the partner location or use online.</p>
    `;
    modal.style.display = "flex";
  }
  soundEngine.fanfare();
  launchConfetti();
  spawnPointBubble("Voucher Unlocked! 🎟️");
  showToast(`Redeemed: ${title}!`, "🎉");
  addNotification("🎁", "Reward Redeemed!", `${title} — Code: ${code}`, "Just now");
}

function closeVoucherModal(){
  const modal = document.getElementById("voucher-modal");
  if(modal) modal.style.display = "none";
}

function simulateRecyclePoints(){
  userPoints += 50;
  updatePointsDisplay();
  soundEngine.success();
  spawnPointBubble("+50 EcoPoints! ♻️");
  showToast("+50 EcoPoints added from recycling batch!", "🎁");
  addNotification("🎁", "+50 EcoPoints", "Recycling batch verified by driver.", "Just now");
}

function updatePointsDisplay(){
  const el = document.getElementById("user-points-display");
  if(el) el.textContent = userPoints;
  const lb = document.getElementById("lb-user-pts");
  if(lb) lb.textContent = userPoints + " pts";
  renderRewardsCatalog();
}

/* =========================================================
   LIVE CITY MAP — Canvas Animation
   ========================================================= */
const FLEET_DATA = [
  { id: "EV-01", driver: "Rahul Sharma", category: "♻️ Recyclables", status: "active", load: 65, pickups: 4, eta: "12 min", x: 0.25, y: 0.35, tx: 0.55, ty: 0.2 },
  { id: "EV-02", driver: "Priya Nair", category: "🍌 Organic Waste", status: "active", load: 40, pickups: 2, eta: "28 min", x: 0.7, y: 0.6, tx: 0.4, ty: 0.7 },
  { id: "EV-03", driver: "David Chen", category: "🔌 E-Waste", status: "idle", load: 0, pickups: 0, eta: "Standby", x: 0.45, y: 0.8, tx: 0.45, ty: 0.5 },
  { id: "EV-04", driver: "Sana Al-Mansoor", category: "🛋️ Bulky Items", status: "active", load: 90, pickups: 3, eta: "5 min", x: 0.8, y: 0.25, tx: 0.15, ty: 0.5 },
  { id: "EV-05", driver: "Marcus Vance", category: "☣️ Hazardous", status: "active", load: 30, pickups: 1, eta: "45 min", x: 0.15, y: 0.65, tx: 0.65, ty: 0.85 },
  { id: "EV-06", driver: "Aisha Patel", category: "🗑️ General Waste", status: "idle", load: 0, pickups: 0, eta: "Standby", x: 0.5, y: 0.15, tx: 0.5, ty: 0.15 },
];

const SMART_BINS = [
  { x: 0.2, y: 0.2, fill: 85, color: "#f43f5e" },
  { x: 0.5, y: 0.4, fill: 45, color: "#10b981" },
  { x: 0.75, y: 0.3, fill: 70, color: "#f59e0b" },
  { x: 0.3, y: 0.7, fill: 20, color: "#10b981" },
  { x: 0.65, y: 0.75, fill: 60, color: "#f59e0b" },
  { x: 0.85, y: 0.6, fill: 92, color: "#f43f5e" },
  { x: 0.1, y: 0.45, fill: 35, color: "#0284c7" },
];

let fleetPositions = FLEET_DATA.map(f => ({...f}));
let mapTime = 0;

function initCityMap(){
  const canvas = document.getElementById("citymap-canvas");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");

  // Set canvas resolution
  const wrapper = canvas.parentElement;
  canvas.width = wrapper.clientWidth || 900;
  canvas.height = 480;

  if(cityMapAnimFrame) cancelAnimationFrame(cityMapAnimFrame);
  animateCityMap(ctx, canvas);
}

function animateCityMap(ctx, canvas){
  const W = canvas.width;
  const H = canvas.height;
  const isDark = document.body.getAttribute("data-theme") === "dark";

  // Background
  ctx.fillStyle = isDark ? "#0d1a12" : "#f0faf4";
  ctx.fillRect(0, 0, W, H);

  // Draw city grid
  ctx.strokeStyle = isDark ? "rgba(52,211,153,0.07)" : "rgba(16,185,129,0.12)";
  ctx.lineWidth = 1;
  const gridSize = 60;
  for(let x = 0; x < W; x += gridSize){
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke();
  }
  for(let y = 0; y < H; y += gridSize){
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(W, y); ctx.stroke();
  }

  // Draw collection zones (heat map style)
  const zones = [
    { cx: 0.25, cy: 0.35, r: 0.12, color: "rgba(16,185,129,0.15)", label: "Sector 4" },
    { cx: 0.7, cy: 0.6, r: 0.10, color: "rgba(2,132,199,0.12)", label: "Tech Park" },
    { cx: 0.5, cy: 0.8, r: 0.09, color: "rgba(245,158,11,0.15)", label: "Harbour" },
    { cx: 0.8, cy: 0.25, r: 0.11, color: "rgba(244,63,94,0.12)", label: "Downtown" },
  ];

  zones.forEach(z => {
    const grd = ctx.createRadialGradient(z.cx*W, z.cy*H, 0, z.cx*W, z.cy*H, z.r*W);
    grd.addColorStop(0, z.color);
    grd.addColorStop(1, "transparent");
    ctx.fillStyle = grd;
    ctx.beginPath();
    ctx.arc(z.cx*W, z.cy*H, z.r*W, 0, Math.PI*2);
    ctx.fill();

    // Zone label
    ctx.font = "bold 11px 'Plus Jakarta Sans', sans-serif";
    ctx.fillStyle = isDark ? "rgba(255,255,255,0.5)" : "rgba(15,23,42,0.5)";
    ctx.textAlign = "center";
    ctx.fillText(z.label, z.cx*W, z.cy*H - z.r*W - 6);
  });

  // Draw route lines for active fleet
  fleetPositions.forEach((f, i) => {
    if(f.status !== "active") return;
    ctx.strokeStyle = "rgba(16,185,129,0.25)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.beginPath();
    ctx.moveTo(f.x * W, f.y * H);
    ctx.lineTo(f.tx * W, f.ty * H);
    ctx.stroke();
    ctx.setLineDash([]);
  });

  // Animate fleet positions
  mapTime += 0.003;
  fleetPositions.forEach((f, i) => {
    if(f.status === "active"){
      // Move toward target with sinusoidal offset
      f.x += (f.tx - f.x) * 0.008 + Math.sin(mapTime * 2 + i) * 0.0005;
      f.y += (f.ty - f.y) * 0.008 + Math.cos(mapTime * 2 + i) * 0.0005;
      // Reset when near target
      if(Math.abs(f.x - f.tx) < 0.03 && Math.abs(f.y - f.ty) < 0.03){
        f.tx = 0.1 + Math.random() * 0.8;
        f.ty = 0.1 + Math.random() * 0.8;
      }
    }
  });

  // Draw smart bins
  SMART_BINS.forEach((bin, i) => {
    const bx = bin.x * W, by = bin.y * H;
    const pulse = 1 + Math.sin(mapTime * 3 + i) * 0.15;

    ctx.fillStyle = bin.color + "33";
    ctx.beginPath();
    ctx.arc(bx, by, 18 * pulse, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = bin.color;
    ctx.beginPath();
    ctx.arc(bx, by, 8, 0, Math.PI * 2);
    ctx.fill();

    ctx.font = "bold 10px 'Outfit', sans-serif";
    ctx.fillStyle = isDark ? "#fff" : "#0f172a";
    ctx.textAlign = "center";
    ctx.fillText(bin.fill + "%", bx, by + 22);
  });

  // Draw fleet vehicles
  fleetPositions.forEach((f, i) => {
    const vx = f.x * W, vy = f.y * H;
    const glow = 1 + Math.sin(mapTime * 4 + i * 0.8) * 0.2;

    if(f.status === "active"){
      ctx.fillStyle = "rgba(16,185,129,0.2)";
      ctx.beginPath();
      ctx.arc(vx, vy, 20 * glow, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = "#10b981";
    } else {
      ctx.fillStyle = "#f59e0b";
    }
    ctx.beginPath();
    ctx.arc(vx, vy, 10, 0, Math.PI * 2);
    ctx.fill();

    // Vehicle ID label
    ctx.font = "bold 9px 'Outfit', sans-serif";
    ctx.fillStyle = isDark ? "#ecfdf5" : "#064e3b";
    ctx.textAlign = "center";
    ctx.fillText(f.id, vx, vy - 15);
  });

  cityMapAnimFrame = requestAnimationFrame(() => animateCityMap(ctx, canvas));
}

function renderFleetGrid(){
  const grid = document.getElementById("fleet-grid");
  if(!grid) return;
  grid.innerHTML = FLEET_DATA.map(f => `
    <div class="fleet-card">
      <div class="fleet-card-top">
        <span class="fleet-id">${f.id}</span>
        <span class="fleet-status-dot ${f.status === 'idle' ? 'idle' : ''}"></span>
      </div>
      <div class="fleet-driver">👤 ${f.driver}</div>
      <div class="fleet-info">${f.category}</div>
      <div class="fleet-info" style="margin-top:4px;">📍 ${f.pickups} pickups · ETA: ${f.eta}</div>
      <div class="fleet-load-bar">
        <div class="fleet-load-label">
          <span>Load</span><span>${f.load}%</span>
        </div>
        <div style="height:6px; background:var(--border); border-radius:3px; overflow:hidden;">
          <div style="height:100%; width:${f.load}%; background:${f.load > 80 ? '#f43f5e' : f.load > 50 ? '#f59e0b' : '#10b981'}; border-radius:3px; transition:width 0.8s;"></div>
        </div>
      </div>
    </div>
  `).join("");
}

function renderZoneStats(){
  const grid = document.getElementById("zone-stats-grid");
  if(!grid) return;
  const stats = [
    { icon: "🚚", num: "6", lbl: "Active Vehicles" },
    { icon: "📦", num: "14", lbl: "Today's Pickups" },
    { icon: "♻️", num: "847 kg", lbl: "Waste Diverted Today" },
    { icon: "🌍", num: "312 kg", lbl: "CO2 Prevented Today" },
  ];
  grid.innerHTML = stats.map(s => `
    <div class="zone-stat-card">
      <div class="zone-stat-icon">${s.icon}</div>
      <div class="zone-stat-num">${s.num}</div>
      <div class="zone-stat-lbl">${s.lbl}</div>
    </div>
  `).join("");
}

/* =========================================================
   REPORT AN ISSUE
   ========================================================= */
function pickIssueType(btn, type){
  document.querySelectorAll("#screen-report .slot-btn").forEach(b => b.classList.remove("selected"));
  btn.classList.add("selected");
  issueDraft.type = type;
}

function submitIssue(){
  const name = (document.getElementById("iss-name").value || "").trim();
  const location = (document.getElementById("iss-location").value || "").trim();
  const desc = (document.getElementById("iss-desc").value || "").trim();

  if(!name || !issueDraft.type || !location){
    alert("Please enter your name, issue category, and incident location.");
    return;
  }

  const issue = {
    id: genId("IS"), name, type: issueDraft.type, location, desc, status: "Open",
    createdAt: new Date().toISOString()
  };

  const list = loadIssues();
  list.unshift(issue);
  saveIssues(list);

  document.getElementById("iss-name").value = "";
  document.getElementById("iss-location").value = "";
  document.getElementById("iss-desc").value = "";

  addNotification("🚨", "Incident Reported!", `${issueDraft.type} at ${location} — Dispatching crew.`, "Just now");
  showToast(`🚨 Incident report (${issue.id}) dispatched to crews!`);
  goTo("screen-home");
}

/* =========================================================
   LEARN SCREEN
   ========================================================= */
const LEARN_CARDS = [
  { css:"learn-wet", title:"🍌 Green Bin — Wet / Organic Food", text:"Fruit & vegetable peels, leftover food scraps, tea leaves, eggshells, coffee grounds. Empty directly into the green bin daily." },
  { css:"learn-dry", title:"♻️ Blue Bin — Dry / Recyclables", text:"Clean plastics (PET/HDPE), paper cartons, aluminum soda cans, clean glass bottles. Rinse residues and compress before throwing." },
  { css:"learn-hazard", title:"☣️ Red Bin — Hazardous & Chemicals", text:"Batteries, expired medicines, paint cans, chemicals, and medical syringes. Keep securely separated for specialized hazardous handling." },
  { css:"learn-ewaste", title:"🔌 Grey Bin — E-Waste & Electronics", text:"Old smartphones, computer cables, chargers, fluorescent bulbs, circuit boards. Book an e-waste pickup for certified recovery." },
];

function renderLearn(){
  const grid = document.getElementById("learn-grid");
  if (!grid) return;
  grid.innerHTML = LEARN_CARDS.map(c => `
    <div class="learn-card ${c.css}">
      <h3>${c.title}</h3>
      <p>${c.text}</p>
    </div>
  `).join("");
  renderQuiz();
  renderRadarBins();
}

/* =========================================================
   WASTE QUIZ
   ========================================================= */
const QUIZ_QUESTIONS = [
  { q: "Where do banana peels go?", opts: ["♻️ Blue Bin", "🍌 Green Bin", "☣️ Red Bin", "🔌 Grey Bin"], ans: 1 },
  { q: "Old smartphone batteries belong in?", opts: ["🍌 Green Bin", "🗑️ Black Bin", "🔌 Grey Bin", "♻️ Blue Bin"], ans: 2 },
  { q: "Clean plastic bottles can go in the?", opts: ["♻️ Blue Bin", "🍌 Green Bin", "☣️ Red Bin", "🗑️ Black Bin"], ans: 0 },
  { q: "Expired medicines should go in the?", opts: ["♻️ Blue Bin", "🍌 Green Bin", "🗑️ Black Bin", "☣️ Red Bin"], ans: 3 },
  { q: "Corrugated cardboard should go in?", opts: ["🍌 Green Bin", "♻️ Blue Bin", "☣️ Red Bin", "🔌 Grey Bin"], ans: 1 },
];

let quizIndex = 0;
let quizScore = 0;

function renderQuiz(){
  const box = document.getElementById("quiz-box");
  if(!box) return;
  if(quizIndex >= QUIZ_QUESTIONS.length){
    box.innerHTML = `
      <div style="text-align:center; padding:20px;">
        <div style="font-size:60px; margin-bottom:12px;">${quizScore >= 4 ? "🏆" : quizScore >= 3 ? "🎉" : "📚"}</div>
        <h3 style="font-size:22px; margin-bottom:8px;">Quiz Complete!</h3>
        <div class="quiz-score-badge">Score: ${quizScore}/${QUIZ_QUESTIONS.length}</div>
        <p style="color:var(--muted); margin-bottom:20px;">${quizScore >= 4 ? "Excellent! You're a waste sorting expert! 🌱" : "Good job! Keep learning to become a master! 📚"}</p>
        ${quizScore >= 3 ? `<div style="background:var(--green-light); border:1px solid var(--green); border-radius:12px; padding:12px; margin-bottom:16px; font-weight:700; color:var(--green-dark);">🎁 +${quizScore*50} EcoPoints awarded!</div>` : ""}
        <button class="huge-btn huge-btn-green" onclick="restartQuiz()"><span>🔄</span><span>Try Again</span></button>
      </div>`;
    return;
  }
  const q = QUIZ_QUESTIONS[quizIndex];
  box.innerHTML = `
    <div class="quiz-score-badge">Question ${quizIndex+1}/${QUIZ_QUESTIONS.length} · Score: ${quizScore}</div>
    <div class="quiz-question-title">${q.q}</div>
    <div class="quiz-opts">
      ${q.opts.map((o,i) => `
        <button class="quiz-opt-btn" onclick="answerQuiz(${i})">${o}</button>
      `).join("")}
    </div>`;
}

function answerQuiz(idx){
  const q = QUIZ_QUESTIONS[quizIndex];
  const btns = document.querySelectorAll(".quiz-opt-btn");
  btns.forEach((b, i) => {
    b.disabled = true;
    if(i === q.ans) b.classList.add("correct");
    if(i === idx && idx !== q.ans) b.classList.add("wrong");
  });
  if(idx === q.ans) {
    quizScore++;
    soundEngine.success();
    spawnPointBubble("+50 EcoPoints! 🎯");
    showToast("✅ Correct!", "🌱");
  } else {
    soundEngine.error();
    showToast("❌ Wrong — correct answer highlighted", "📚");
  }
  setTimeout(() => { quizIndex++; renderQuiz(); }, 1400);
}

function restartQuiz(){
  quizIndex = 0;
  quizScore = 0;
  renderQuiz();
}

/* =========================================================
   COMMUNITY SMART BIN RADAR
   ========================================================= */
const BIN_LOCATIONS = [
  { name: "Metro Station Bin", sector: "Downtown", color: "#f43f5e" },
  { name: "Green Park Corner", sector: "Sector 4", color: "#10b981" },
  { name: "Tech Park Lobby", sector: "Tech Park", color: "#f59e0b" },
  { name: "Harbour Promenade", sector: "Harbour", color: "#10b981" },
  { name: "School Zone Bin", sector: "Sector 2", color: "#0284c7" },
  { name: "Market Square", sector: "Downtown", color: "#f43f5e" },
];

function renderRadarBins(){
  const grid = document.getElementById("radar-bins-grid");
  if(!grid) return;
  grid.innerHTML = BIN_LOCATIONS.map((b, i) => {
    const fill = Math.floor(20 + Math.random() * 75);
    const urgent = fill >= 80;
    return `
    <div class="radar-bin-item">
      <div class="r-head">
        <div class="r-name">${b.name}</div>
        <div class="r-pct" style="color:${b.color}">${fill}%</div>
      </div>
      <div style="font-size:11px; color:var(--muted); margin-bottom:8px;">${b.sector}</div>
      <div class="radar-bar-bg">
        <div class="radar-bar-fill" style="width:${fill}%; background:${b.color};"></div>
      </div>
      ${urgent ? `<div style="font-size:11px; color:var(--red); font-weight:700; margin-bottom:8px;">⚠️ Urgent collection needed</div>` : ""}
      <button class="r-action-btn" onclick="reportBin('${b.name}')">
        ${urgent ? "🚨 Request Emergency Pickup" : "📋 Report Status"}
      </button>
    </div>`;
  }).join("");
}

function refreshRadarBins(){ renderRadarBins(); showToast("Sensor data refreshed!", "🔄"); }

function reportBin(name){
  showToast(`Overflow report for "${name}" dispatched!`, "🚨");
  addNotification("⚠️", "Bin Overflow Reported", `${name} — Crew dispatched.`, "Just now");
}

/* =========================================================
   ADMIN COMMAND
   ========================================================= */
function checkAdminCode(){
  const code = (document.getElementById("admin-code").value || "").trim();
  if(code === ADMIN_CODE){
    document.getElementById("admin-code").value = "";
    goTo("screen-admin");
    renderAdminStats();
    renderAdminCatBars();
    renderAdminList();
    renderAdminIssues();
    showToast("Authenticated dispatcher session", "🔑");
  } else {
    alert("Incorrect code. Demo dispatcher passcode is: 1234");
  }
}

function renderAdminStats(){
  const list = loadRequests();
  const counts = { Pending:0, Scheduled:0, Collected:0, Cancelled:0 };
  list.forEach(r => counts[r.status] = (counts[r.status]||0) + 1);

  const el = document.getElementById("admin-stats");
  if (!el) return;

  el.innerHTML = `
    <div class="stat-box"><div class="n">${list.length}</div><div class="l">Total Pickups</div></div>
    <div class="stat-box"><div class="n" style="color:var(--amber);">${counts.Pending}</div><div class="l">Pending</div></div>
    <div class="stat-box"><div class="n" style="color:var(--blue);">${counts.Scheduled}</div><div class="l">Scheduled</div></div>
    <div class="stat-box"><div class="n" style="color:var(--green-mid);">${counts.Collected}</div><div class="l">Collected</div></div>
  `;
}

function renderAdminCatBars(){
  const list = loadRequests();
  const counts = {};
  list.forEach(r => counts[r.category] = (counts[r.category]||0) + 1);
  const max = Math.max(1, ...Object.values(counts));
  const el = document.getElementById("admin-cat-bars");
  if (!el) return;

  el.innerHTML = CATEGORIES.map(c => {
    const n = counts[c.key] || 0;
    return `
      <div class="bar-row">
        <div class="name">${c.icon} ${c.label}</div>
        <div class="bar-track">
          <div class="bar-fill" style="width:${(n/max*100).toFixed(0)}%"></div>
        </div>
        <div style="font-weight:700;">${n}</div>
      </div>`;
  }).join("");
}

function renderAdminList(){
  const q = (document.getElementById("admin-search").value || "").toLowerCase();
  const statusF = document.getElementById("admin-filter").value;
  let list = loadRequests().slice();

  if(q) list = list.filter(r => r.name.toLowerCase().includes(q) || r.address.toLowerCase().includes(q) || r.id.toLowerCase().includes(q));
  if(statusF) list = list.filter(r => r.status === statusF);

  const el = document.getElementById("admin-list");
  if (!el) return;

  el.innerHTML = list.length ? list.map(r => `
    <div class="req-card">
      <div class="req-top-row">
        <span class="req-id">${r.id}</span>
        <span class="status-badge status-${r.status}">${r.status}</span>
      </div>
      <div class="req-line"><strong>${categoryLabel(r.category)}</strong></div>
      <div class="req-line">👤 ${r.name} ${r.phone ? "· 📞 " + r.phone : ""}</div>
      <div class="req-line">📅 ${r.date || "Scheduled"} · ${r.slot || "Anytime"}</div>
      <div class="req-line">📍 ${r.address}</div>
      <div class="admin-actions">
        <select onchange="updateStatus('${r.id}', this.value)">
          <option value="">Update status...</option>
          <option value="Pending" ${r.status==='Pending'?'selected':''}>Pending</option>
          <option value="Scheduled" ${r.status==='Scheduled'?'selected':''}>Scheduled</option>
          <option value="Collected" ${r.status==='Collected'?'selected':''}>Collected</option>
          <option value="Cancelled" ${r.status==='Cancelled'?'selected':''}>Cancelled</option>
        </select>
      </div>
    </div>`).join("") : `<p class="empty-msg">No pickup requests match.</p>`;
}

function updateStatus(id, newStatus){
  if(!newStatus) return;
  const list = loadRequests();
  const r = list.find(r => r.id === id);
  if(!r) return;
  r.status = newStatus;
  r.history = r.history || [];
  r.history.push({ status: newStatus, at: new Date().toISOString() });
  saveRequests(list);
  renderAdminStats();
  renderAdminCatBars();
  renderAdminList();
  showToast(`Updated ${id} to ${newStatus}`);
}

function renderAdminIssues(){
  const list = loadIssues();
  const el = document.getElementById("admin-issues-list");
  if (!el) return;

  el.innerHTML = list.length ? list.map(i => `
    <div class="req-card">
      <div class="req-top-row">
        <span class="req-id">${i.id}</span>
        <span class="status-badge status-Pending">${i.status}</span>
      </div>
      <div class="req-line" style="color:var(--red); font-weight:700;">🚨 ${i.type}</div>
      <div class="req-line">👤 ${i.name}</div>
      <div class="req-line">📍 ${i.location}</div>
      ${i.desc ? `<div class="req-line" style="font-style:italic;">"${i.desc}"</div>` : ""}
    </div>`).join("") : `<p class="empty-msg">No issues reported yet.</p>`;
}

function showAdminTab(tab){
  document.getElementById("tab-requests").classList.toggle("active", tab === "requests");
  document.getElementById("tab-issues").classList.toggle("active", tab === "issues");
  document.getElementById("admin-requests-view").style.display = tab === "requests" ? "block" : "none";
  document.getElementById("admin-issues-view").style.display = tab === "issues" ? "block" : "none";
  if(tab === "issues") renderAdminIssues();
}

function exportRequestsCSV(){
  const list = loadRequests();
  const header = "ID,Category,Name,Phone,Address,Date,Slot,Status\n";
  const rows = list.map(r => `${r.id},${r.category},${r.name},${r.phone},${r.address},${r.date},${r.slot},${r.status}`).join("\n");
  const blob = new Blob([header + rows], { type: "text/csv" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "ecopickup-requests.csv"; a.click();
  URL.revokeObjectURL(url);
  showToast("CSV exported successfully!", "📥");
}

/* =========================================================
   HERO PARTICLE SYSTEM
   ========================================================= */
function initHeroParticles(){
  const canvas = document.getElementById("hero-particles");
  if(!canvas) return;
  const ctx = canvas.getContext("2d");
  const hero = canvas.parentElement;
  canvas.width = hero.clientWidth;
  canvas.height = hero.clientHeight;

  const particles = [];
  const count = 55;
  const mouse = { x: null, y: null };

  hero.addEventListener("mousemove", (e) => {
    const rect = canvas.getBoundingClientRect();
    mouse.x = e.clientX - rect.left;
    mouse.y = e.clientY - rect.top;
  });

  hero.addEventListener("mouseleave", () => {
    mouse.x = null;
    mouse.y = null;
  });

  for(let i = 0; i < count; i++){
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 1.2 + Math.random() * 2.2,
      dx: (Math.random() - 0.5) * 0.5,
      dy: -0.25 - Math.random() * 0.45,
      opacity: 0.25 + Math.random() * 0.5,
    });
  }

  function animateParticles(){
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw connecting constellation lines
    for(let i = 0; i < particles.length; i++){
      for(let j = i + 1; j < particles.length; j++){
        const dist = Math.hypot(particles[i].x - particles[j].x, particles[i].y - particles[j].y);
        if(dist < 80){
          ctx.beginPath();
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.strokeStyle = `rgba(52, 211, 153, ${0.15 * (1 - dist / 80)})`;
          ctx.lineWidth = 0.8;
          ctx.stroke();
        }
      }
    }

    particles.forEach(p => {
      // Mouse interaction
      if(mouse.x !== null && mouse.y !== null){
        const mDist = Math.hypot(p.x - mouse.x, p.y - mouse.y);
        if(mDist < 100){
          p.x += (p.x - mouse.x) * 0.02;
          p.y += (p.y - mouse.y) * 0.02;
        }
      }

      p.x += p.dx;
      p.y += p.dy;
      if(p.y < -10) { p.y = canvas.height + 10; p.x = Math.random() * canvas.width; }
      if(p.x < 0) p.x = canvas.width;
      if(p.x > canvas.width) p.x = 0;

      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(167, 243, 208, ${p.opacity})`;
      ctx.fill();
    });

    particleAnimFrame = requestAnimationFrame(animateParticles);
  }

  animateParticles();
}

/* =========================================================
   CURSOR GLOW & SCROLL PROGRESS
   ========================================================= */
function initCursorGlow(){
  const glow = document.createElement("div");
  glow.className = "cursor-glow";
  document.body.appendChild(glow);
  document.addEventListener("mousemove", (e) => {
    glow.style.left = e.clientX + "px";
    glow.style.top = e.clientY + "px";
  });
}

function initScrollProgress(){
  const bar = document.createElement("div");
  bar.className = "scroll-progress";
  bar.id = "scroll-progress";
  document.body.insertBefore(bar, document.body.firstChild);

  window.addEventListener("scroll", () => {
    const scrolled = window.scrollY;
    const max = document.documentElement.scrollHeight - window.innerHeight;
    const pct = max > 0 ? (scrolled / max) * 100 : 0;
    bar.style.width = pct + "%";
  });
}

/* =========================================================
   VISUAL EFFECTS: Ripple & Confetti
   ========================================================= */
function addRipple(e){
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const size = Math.max(rect.width, rect.height);
  const ripple = document.createElement("span");
  ripple.className = "ripple";
  ripple.style.width = ripple.style.height = size + "px";
  ripple.style.left = (e.clientX - rect.left - size/2) + "px";
  ripple.style.top = (e.clientY - rect.top - size/2) + "px";
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 600);
}

const CONFETTI_EMOJI = ["🎉","♻️","🌿","✨","🎊","🌱","⚡","🌍"];
function launchConfetti(){
  for(let i = 0; i < 36; i++){
    setTimeout(() => {
      const piece = document.createElement("div");
      piece.className = "confetti-piece";
      piece.textContent = CONFETTI_EMOJI[Math.floor(Math.random()*CONFETTI_EMOJI.length)];
      piece.style.left = Math.random()*100 + "vw";
      piece.style.animationDuration = (2 + Math.random()*1.5) + "s";
      piece.style.fontSize = (16 + Math.random()*14) + "px";
      document.body.appendChild(piece);
      setTimeout(() => piece.remove(), 3600);
    }, i * 50);
  }
}

/* =========================================================
   FAST WASTE SORTER ARCADE SIMULATOR
   ========================================================= */
const ARCADE_ITEMS = [
  { name: "Plastic Soda Bottle", icon: "🥤", cat: "recycle", hint: "Clean PET bottles belong in the Blue Bin (Dry Recyclables)." },
  { name: "Banana Peel", icon: "🍌", cat: "organic", hint: "Fruit and food scraps belong in the Green Bin (Organic / Compost)." },
  { name: "AA Alkaline Battery", icon: "🔋", cat: "hazard", hint: "Batteries leak harmful chemicals! Place in the Red Bin (Hazardous)." },
  { name: "Broken USB Cable", icon: "🔌", cat: "ewaste", hint: "Electronic cables and chargers belong in the Grey Bin (E-Waste)." },
  { name: "Cardboard Delivery Box", icon: "📦", cat: "recycle", hint: "Flattened cardboard boxes belong in the Blue Bin (Dry Recyclables)." },
  { name: "Apple Core", icon: "🍏", cat: "organic", hint: "Organic scraps belong in the Green Bin to produce nutrient-rich compost." },
  { name: "Old Smartphone", icon: "📱", cat: "ewaste", hint: "Smartphones contain valuable metals — book Grey Bin certified recovery." },
  { name: "Expired Cough Syrup", icon: "💊", cat: "hazard", hint: "Medicines and chemical containers belong in the Red Bin (Hazardous)." },
  { name: "Aluminium Drink Can", icon: "🥫", cat: "recycle", hint: "Aluminium is infinitely recyclable! Toss it in the Blue Bin." },
  { name: "Coffee Grounds", icon: "☕", cat: "organic", hint: "Coffee grounds are superb for soil composting! Put in Green Bin." },
  { name: "Fluorescent Light Bulb", icon: "💡", cat: "ewaste", hint: "Fluorescent tubes have trace phosphor — Grey Bin collection keeps them safe." },
  { name: "Spray Paint Can", icon: "🎨", cat: "hazard", hint: "Aerosols and paint cans belong in the Red Bin (Hazardous)." },
];

let arcadeItemIdx = 0;
let arcadeStreak = 0;
let arcadePointsTotal = 0;
let arcadeAttempts = 0;
let arcadeCorrectCount = 0;

function setupArcadeGame() {
  arcadeItemIdx = Math.floor(Math.random() * ARCADE_ITEMS.length);
  renderCurrentArcadeItem();
}

function renderCurrentArcadeItem() {
  const item = ARCADE_ITEMS[arcadeItemIdx];
  const iconEl = document.getElementById("arcade-item-icon");
  const nameEl = document.getElementById("arcade-item-name");
  const card = document.getElementById("arcade-current-item");
  if (iconEl && nameEl) {
    iconEl.textContent = item.icon;
    nameEl.textContent = item.name;
    if (card) {
      card.classList.remove("pop-new");
      void card.offsetWidth;
      card.classList.add("pop-new");
    }
  }
}

function arcadeSort(chosenCat) {
  soundEngine.init();
  const item = ARCADE_ITEMS[arcadeItemIdx];
  arcadeAttempts++;
  const feedbackEl = document.getElementById("arcade-feedback");
  const binEl = document.getElementById("bin-" + chosenCat);

  if (chosenCat === item.cat) {
    arcadeStreak++;
    arcadeCorrectCount++;
    const earned = 25 * (arcadeStreak > 3 ? 2 : 1);
    arcadePointsTotal += earned;
    userPoints += earned;
    updatePointsDisplay();

    soundEngine.success();

    if (binEl) {
      binEl.classList.remove("bin-active-correct");
      void binEl.offsetWidth;
      binEl.classList.add("bin-active-correct");
      setTimeout(() => binEl.classList.remove("bin-active-correct"), 600);
    }

    const rect = binEl ? binEl.getBoundingClientRect() : { left: window.innerWidth / 2, top: window.innerHeight / 2 };
    spawnPointBubble(`+${earned} EcoPoints! ✨`, rect.left + 20, rect.top - 20);

    if (feedbackEl) {
      feedbackEl.innerHTML = `<span style="color:var(--green-mid); font-weight:800;">🎉 Perfect! ${item.hint} (+${earned} pts)</span>`;
    }

    setTimeout(() => {
      arcadeItemIdx = (arcadeItemIdx + 1 + Math.floor(Math.random() * (ARCADE_ITEMS.length - 1))) % ARCADE_ITEMS.length;
      renderCurrentArcadeItem();
    }, 450);

  } else {
    arcadeStreak = 0;
    soundEngine.error();

    if (binEl) {
      binEl.classList.remove("bin-active-wrong");
      void binEl.offsetWidth;
      binEl.classList.add("bin-active-wrong");
      setTimeout(() => binEl.classList.remove("bin-active-wrong"), 500);
    }

    if (feedbackEl) {
      feedbackEl.innerHTML = `<span style="color:var(--red); font-weight:700;">⚠️ Not quite! ${item.hint}</span>`;
    }
  }

  const streakEl = document.getElementById("arcade-streak");
  const ptsEl = document.getElementById("arcade-pts");
  const accEl = document.getElementById("arcade-acc");
  if (streakEl) streakEl.textContent = arcadeStreak + (arcadeStreak >= 3 ? " 🔥🔥" : arcadeStreak > 0 ? " 🔥" : "");
  if (ptsEl) ptsEl.textContent = `+${arcadePointsTotal} pts`;
  if (accEl) accEl.textContent = Math.round((arcadeCorrectCount / arcadeAttempts) * 100) + "%";
}

/* =========================================================
   LIVE GPS DRIVER TRIP SIMULATOR (Tracker Screen)
   ========================================================= */
const activeSimTrips = {};

function simulateGpsTrip(reqId) {
  soundEngine.init();
  soundEngine.pop();
  const panel = document.getElementById("trip-panel-" + reqId);
  if (!panel) return;

  if (activeSimTrips[reqId]) return;
  activeSimTrips[reqId] = true;

  panel.innerHTML = `
    <div class="live-trip-panel">
      <div class="trip-status-header">
        <span class="trip-live-tag"><span class="pulse-ring"></span> GPS FLEET EN ROUTE</span>
        <span class="trip-eta" id="trip-eta-${reqId}">ETA: 6 mins</span>
      </div>
      <div class="trip-progress-bar">
        <div class="trip-progress-fill" id="trip-fill-${reqId}"></div>
      </div>
      <div class="trip-msg" id="trip-msg-${reqId}">🚚 Electric Van EV-07 has departed depot. Driver: Rahul S.</div>
    </div>
  `;

  const fill = document.getElementById("trip-fill-" + reqId);
  const msg = document.getElementById("trip-msg-" + reqId);
  const eta = document.getElementById("trip-eta-" + reqId);

  setTimeout(() => {
    if (fill) fill.style.width = "30%";
    if (msg) msg.textContent = "📍 Electric Van is 1.4 km away on Sector 4 Main Rd.";
    if (eta) eta.textContent = "ETA: 4 mins";
    soundEngine.play(440, "sine", 0.08, 0.1);
  }, 1200);

  setTimeout(() => {
    if (fill) fill.style.width = "70%";
    if (msg) msg.textContent = "🚚 Approaching your lane! Ringing entry intercom...";
    if (eta) eta.textContent = "ETA: 1 min";
    soundEngine.play(554, "sine", 0.08, 0.1);
  }, 2600);

  setTimeout(() => {
    if (fill) fill.style.width = "100%";
    if (msg) msg.innerHTML = "✅ <strong>Driver arrived! Batch weighed: 16.4 kg. Certified eco-transfer logged.</strong>";
    if (eta) eta.textContent = "COMPLETED";
    soundEngine.fanfare();
    launchConfetti();
    spawnPointBubble("+50 EcoPoints Awarded! 🎁");
    userPoints += 50;
    updatePointsDisplay();

    updateStatus(reqId, "Collected");
    delete activeSimTrips[reqId];
  }, 4200);
}

/* =========================================================
   3D CARD TILT INTERACTION
   ========================================================= */
function init3DCardTilt() {
  const cards = document.querySelectorAll(".feature-box, .how-card, .challenge-card, .stat-tile, .cat-tile, .reward-item-card");
  cards.forEach(card => {
    card.addEventListener("mousemove", (e) => {
      const rect = card.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      card.style.transform = `perspective(700px) rotateX(${-y * 10}deg) rotateY(${x * 10}deg) translateY(-8px) scale3d(1.02, 1.02, 1.02)`;
    });
    card.addEventListener("mouseleave", () => {
      card.style.transform = "";
    });
  });
}

/* =========================================================
   INITIALIZATION
   ========================================================= */
document.addEventListener("DOMContentLoaded", () => {
  applyTheme(localStorage.getItem("ecoTheme") || "light");
  const dateInput = document.getElementById("in-date");
  if(dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.min = today;
    dateInput.value = today;
  }

  // Initialize sound icon
  const soundBtn = document.getElementById("sound-toggle");
  if (soundBtn && localStorage.getItem("ecoSound") === "off") {
    soundBtn.textContent = "🔇";
    soundBtn.classList.add("muted");
  }

  document.querySelectorAll(".huge-btn, .cta, .nav-link").forEach(btn => {
    btn.addEventListener("click", (e) => {
      addRipple(e);
      soundEngine.pop();
    });
  });

  loadRequests();
  loadIssues();

  renderHomeStats();
  renderHomeCategories();
  renderFAQ();
  renderChallenges();
  renderCityFeed();
  observeReveals();

  initNotifDot();
  initHeroParticles();
  initCursorGlow();
  initScrollProgress();
  updateImpactCalc();

  tickTypewriter();
  setupArcadeGame();
  init3DCardTilt();

  // Auto-refresh city feed every 15 seconds
  setInterval(() => {
    if(document.getElementById("city-feed")) {
      const newEvent = {
        icon: ["🚚","♻️","✅","🌱","⚡"][Math.floor(Math.random()*5)],
        title: ["New pickup scheduled", "Collection verified", "Route optimized", "Batch processed"][Math.floor(Math.random()*4)],
        detail: "Sector " + Math.floor(1+Math.random()*8) + " · " + Math.floor(5+Math.random()*30) + " kg collected",
        time: "Just now",
        badge: "+20 pts"
      };
      FEED_EVENTS.unshift(newEvent);
      if(FEED_EVENTS.length > 10) FEED_EVENTS.pop();
      if(document.getElementById("screen-home")?.classList.contains("active")){
        renderCityFeed();
      }
    }
  }, 15000);
});
