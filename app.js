// ============================================================================
// UMT Facility Feedback Reporter – Annotated Source
// ---------------------------------------------------------------------------
// Comments have been inserted throughout to explain what each major block or
// function does. Code behaviour, names, and flow remain untouched.
// ============================================================================



// ─────────────────────────────────────────────────────────────────────────────
// Service-Worker Registration
// Registers sw.js once the page has loaded so the app can work offline / cache
// assets. Errors are logged to the console.
// ─────────────────────────────────────────────────────────────────────────────
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then(() => console.log("ServiceWorker registration successful"))
      .catch((err) => console.log("ServiceWorker registration failed:", err));
  });
}



// ─────────────────────────────────────────────────────────────────────────────
// DOM Element Short-cuts
// Grab every element we’ll need. Keeping them in constants avoids multiple
// document.querySelector calls later.
// ─────────────────────────────────────────────────────────────────────────────
const pages                 = document.querySelectorAll(".page");
const navLinks              = document.querySelectorAll(".nav-link");
const menuBtn               = document.getElementById("menu-btn");
const closeNavBtn           = document.getElementById("close-nav-btn");
const sideNav               = document.getElementById("side-nav");

const mapView               = document.getElementById("map-view");
const reportIssuePage       = document.getElementById("report-issue");
const myReportsPage         = document.getElementById("my-reports");
const galleryPage           = document.getElementById("gallery");
const aboutPage             = document.getElementById("about");

const newReportBtn          = document.getElementById("new-report-btn");
const currentLocationBtn    = document.getElementById("current-location-btn");

const reportForm            = document.getElementById("report-form");
const imagePreview          = document.getElementById("image-preview");

const cameraBtn             = document.getElementById("camera-btn");
const galleryBtn            = document.getElementById("gallery-btn");
const fileInput             = document.getElementById("file-input");

const selectLocationBtn     = document.getElementById("select-location-btn");
const locationDisplay       = document.getElementById("location-display");

const reportsList           = document.getElementById("reports-list");
const filterBtns            = document.querySelectorAll(".filter-btn");

const galleryContainer      = document.getElementById("gallery-container");

const cameraModal           = document.getElementById("camera-modal");
const closeModalBtns        = document.querySelectorAll(".close-modal");
const cameraView            = document.getElementById("camera-view");
const captureBtn            = document.getElementById("capture-btn");
const canvas                = document.getElementById("canvas");

const locationModal         = document.getElementById("location-modal");
const locationMapElement    = document.getElementById("location-map");
const confirmLocationBtn    = document.getElementById("confirm-location-btn");

const reportDetailsModal    = document.getElementById("report-details-modal");
const reportDetailsContent  = document.getElementById("report-details-content");

const themeSwitch           = document.getElementById("theme-switch");



// ─────────────────────────────────────────────────────────────────────────────
// Application-level State
// Everything that persists while the tab is open lives here.
// ─────────────────────────────────────────────────────────────────────────────
let currentPage     = "map-view"; // default landing page in SPA navigation
let currentLocation = null;       // selected lat/lng for a new report
let selectedImages  = [];         // max 5 screenshots/photos per report
let reports         = [];         // array of report objects (loaded from LS)
let map, locationMap;             // Leaflet map instances
let stream          = null;       // MediaStream from getUserMedia
let currentFacingMode = "user";   // 'user' (selfie) vs 'environment' (rear)

// Colour codes for category-specific map pins
const categoryColors = {
  electrical : '#E74C3C', // red
  plumbing   : '#3498DB', // blue
  furniture  : '#9B59B6', // purple
  cleanliness: '#2ECC71', // green
  other      : '#7F8C8D'  // grey (fallback)
};



// ─────────────────────────────────────────────────────────────────────────────
// initApp()
// Entry-point once DOMContentLoaded fires. Kicks off theming, event listeners,
// report loading, map initialisation, and PWA install prompt handling.
// ─────────────────────────────────────────────────────────────────────────────
function initApp() {
  const savedTheme = localStorage.getItem('theme') || 'light';
  setTheme(savedTheme);
  setupEventListeners();
  loadReports();
  initMap();
  checkGeolocation();
  checkPWAInstallPrompt();
}



// ─────────────────────────────────────────────────────────────────────────────
// setTheme(theme)
// Switches between light/dark; persists choice in localStorage.
// ─────────────────────────────────────────────────────────────────────────────
function setTheme(theme) {
  localStorage.setItem('theme', theme);
  if (theme === 'dark') {
    document.body.classList.add('dark-mode');
    themeSwitch.checked = true;
  } else {
    document.body.classList.remove('dark-mode');
    themeSwitch.checked = false;
  }
}



// ─────────────────────────────────────────────────────────────────────────────
// renderMapLegend()
// Builds a small HTML legend explaining pin colours. Runs once on map init.
// ─────────────────────────────────────────────────────────────────────────────
function renderMapLegend() {
  const legend  = document.getElementById('map-legend');
  let content   = '<h4>Legend</h4><ul>';

  for (const category in categoryColors) {
    const color = categoryColors[category];
    const name  = category.charAt(0).toUpperCase() + category.slice(1);
    content += `<li><span class="legend-color-box" style="background-color:${color}"></span> ${name}</li>`;
  }

  legend.innerHTML = content + '</ul>';
}



// ─────────────────────────────────────────────────────────────────────────────
// setupEventListeners()
// Wires up **all** UI interactions (nav, forms, modals, theme toggle, etc.).
// Keeping them centralised means we can read the complete interaction surface
// at a glance.
// ─────────────────────────────────────────────────────────────────────────────
function setupEventListeners() {

  // ── Map refresh button ────────────────────────────────────────────────
  document.getElementById("refresh-map-btn").addEventListener("click", function () {
    loadReportsOnMap();             // re-plot markers
    this.innerHTML = "⏳";           // simple "loading" icon animation
    setTimeout(() => (this.innerHTML = "🔄"), 1000);
  });



  // ── Side-nav show / hide ───────────────────────────────────────────────
  menuBtn.addEventListener("click",  toggleSideNav);
  closeNavBtn.addEventListener("click", toggleSideNav);



  // ── Navigation links (single-page routing) ────────────────────────────
  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const page = link.getAttribute("data-page");
      navigateTo(page);
      toggleSideNav();
    });
  }); // <-- THE FOREACH LOOP ENDS HERE



  // ── Location-modal "use current location" quick button ────────────────
  document.getElementById("modal-current-location-btn").addEventListener("click", () => {
    if (!navigator.geolocation) return;

    showToast("Finding your location...", "info");
    navigator.geolocation.getCurrentPosition(
      (pos)   => {
        const userLoc = [pos.coords.latitude, pos.coords.longitude];
        if (locationMap) {
          locationMap.setView(userLoc, 18);
          locationMap.eachLayer((layer) => {
            if (layer instanceof L.Marker) layer.setLatLng(userLoc);
          });
        }
      },
      (err) => showToast("Unable to get your location: " + err.message, "error")
    );
  });



  // ── Landing-page quick-links ──────────────────────────────────────────
  document.getElementById("go-to-report").addEventListener("click", () => navigateTo("report-issue"));
  document.getElementById("go-to-map").addEventListener("click",    () => navigateTo("map-view"));
  document.getElementById("go-to-my-reports").addEventListener("click", () => navigateTo("my-reports"));

  // Logo / Title act as "home" buttons
  document.getElementById("logo-btn").addEventListener("click",  () => navigateTo("landing-page"));
  document.getElementById("title-btn").addEventListener("click", () => navigateTo("landing-page"));



  // ── Camera switch (front / back) inside camera modal ──────────────────
  document.getElementById("switch-camera-btn").addEventListener("click", () => {
    currentFacingMode = currentFacingMode === "user" ? "environment" : "user";
    openCamera(currentFacingMode);
  });



  // ── Map View page buttons ─────────────────────────────────────────────
  newReportBtn.addEventListener("click", () => navigateTo("report-issue"));
  currentLocationBtn.addEventListener("click", centerMapOnUser);



  // ── Report Form interactions ──────────────────────────────────────────
  reportForm.addEventListener("submit", submitReport);

  cameraBtn.addEventListener("click", () => {
    currentFacingMode = "user";  // default to front cam on first open
    openCamera(currentFacingMode);
  });

  galleryBtn.addEventListener("click", () => fileInput.click());
  fileInput .addEventListener("change", handleFileSelect);
  selectLocationBtn.addEventListener("click", openLocationPicker);



  // ── Camera modal controls ─────────────────────────────────────────────
  captureBtn.addEventListener("click", capturePhoto);
  closeModalBtns.forEach((btn) => btn.addEventListener("click", closeModal));



  // ── Location picker ───────────────────────────────────────────────────
  confirmLocationBtn.addEventListener("click", confirmLocation);



  // ── Reports list filter buttons ───────────────────────────────────────
  filterBtns.forEach((btn) =>
    btn.addEventListener("click", () => filterReports(btn.getAttribute("data-status")))
  );



  // ── Dark-mode toggle ──────────────────────────────────────────────────
  themeSwitch.addEventListener('change', () =>
    setTheme(themeSwitch.checked ? 'dark' : 'light')
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// initMap()
// Sets up the main Leaflet map centred on UMT, loads existing reports & legend.
// ─────────────────────────────────────────────────────────────────────────────
function initMap() {
  const umtCoordinates = [5.4072, 103.0883];         // campus default
  map = L.map("map").setView(umtCoordinates, 16);    // zoom level 16

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  // quick-add marker when user clicks the map (only on map-view page)
  map.on("click", (e) => {
    if (currentPage !== "map-view") return;
    L.marker(e.latlng)
      .addTo(map)
      .bindPopup(
        `<b>New Report Location</b><br>Lat: ${e.latlng.lat.toFixed(4)}, Lng: ${e.latlng.lng.toFixed(4)}`
      ).openPopup();
  });

  loadReportsOnMap();  // plot stored markers
  renderMapLegend();   // one-time legend
}



// ─────────────────────────────────────────────────────────────────────────────
// initLocationMap()
// Creates / resets the small map inside the location-picker modal.
// ─────────────────────────────────────────────────────────────────────────────
function initLocationMap() {

  // If already initialised, wipe & recreate (Leaflet API quirk)
  if (locationMap) { locationMap.remove(); locationMap = null; }

  const defaultCenter = map.getCenter(); // fall back to whatever the main map shows
  let   marker;

  locationMap = L.map("location-map").setView(defaultCenter, 16);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(locationMap);

  // draggable marker initially at centre
  marker = L.marker(defaultCenter, { draggable:true }).addTo(locationMap);

  // Attempt to recenter on user GPS automatically
  if (navigator.geolocation) {
    showToast("Finding your location...", "info");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const userLoc = [pos.coords.latitude, pos.coords.longitude];
        locationMap.setView(userLoc, 18);
        marker.setLatLng(userLoc);
      },
      () => {
        showToast("Could not find location. Please select manually.", "warning");
        marker.bindPopup("Drag to select location").openPopup();
      }
    );
  } else {
    marker.bindPopup("Drag to select location").openPopup();
  }

  // Update marker position on map click
  locationMap.on("click", (e) => marker.setLatLng(e.latlng));
}



// ─────────────────────────────────────────────────────────────────────────────
// centerMapOnUser()
// Geolocates and pans the main map to the current user position.
// ─────────────────────────────────────────────────────────────────────────────
function centerMapOnUser() {
  if (!navigator.geolocation) {
    showToast("Geolocation is not supported by your browser", "error");
    return;
  }

  navigator.geolocation.getCurrentPosition(
    (pos) => {
      const userLoc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      map.setView(userLoc, 18);
      L.marker(userLoc).addTo(map).bindPopup("Your current location").openPopup();
    },
    (err) => showToast("Unable to get your location: " + err.message, "error")
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// checkGeolocation()
// If permission already granted, auto-center map at startup.
// ─────────────────────────────────────────────────────────────────────────────
function checkGeolocation() {
  if (!navigator.permissions) return;
  navigator.permissions.query({ name:"geolocation" })
    .then((status) => { if (status.state === "granted") centerMapOnUser(); });
}



// ─────────────────────────────────────────────────────────────────────────────
// navigateTo(page)
// Simple SPA view switcher – hides all .page elements then shows the chosen
// one, updates nav link "active" state, and handles per-page tweaks.
// ─────────────────────────────────────────────────────────────────────────────
function navigateTo(page) {
  pages.forEach((p) => p.classList.remove("active-page"));       // hide all
  const target = document.getElementById(page);
  if (target) target.classList.add("active-page");               // show one

  navLinks.forEach((link) => {
    link.classList.remove("active");
    if (link.getAttribute("data-page") === page) link.classList.add("active");
  });

  currentPage = page;

  // page-specific hooks
  if      (page === "gallery")    renderGallery();
  else if (page === "my-reports") renderReportsList();
  else if (page === "map-view" && map) setTimeout(() => map.invalidateSize(), 100);
}



// ─────────────────────────────────────────────────────────────────────────────
// toggleSideNav()
// Slides the side nav in/out (adds/removes .active on <aside id="side-nav">)
// ─────────────────────────────────────────────────────────────────────────────
function toggleSideNav() { sideNav.classList.toggle("active"); }



// ─────────────────────────────────────────────────────────────────────────────
// openCamera(facingMode)
// Opens camera modal & starts requested camera ('user' or 'environment').
// ─────────────────────────────────────────────────────────────────────────────
function openCamera(facingMode = "user") {

  // stop any existing MediaStream first (switching cams)
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
  }

  const constraints = { video: { facingMode: { exact: facingMode } } };
  cameraModal.style.display = "flex"; // show immediately so user sees modal

  navigator.mediaDevices.getUserMedia(constraints)
    .then((mediaStream) => {
      stream         = mediaStream;
      cameraView.srcObject = stream;
    })
    .catch((err) => {
      console.error("Error accessing camera:", err);
      showToast(`Could not access ${facingMode} camera. It may not be available on this device.`, "error");
      // we leave modal open in case user switches facingMode
    });
}



// ─────────────────────────────────────────────────────────────────────────────
// closeModal()
// Closes *all* .modal elements & stops camera stream if active.
// ─────────────────────────────────────────────────────────────────────────────
function closeModal() {
  document.querySelectorAll(".modal").forEach((m) => (m.style.display = "none"));

  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
    cameraView.srcObject = null;
  }
}



// ─────────────────────────────────────────────────────────────────────────────
// capturePhoto()
// Draws current frame to <canvas>, converts to dataURL, then stores preview.
// Guards against zero-dimension video (camera not ready).
// ─────────────────────────────────────────────────────────────────────────────
function capturePhoto() {
  if (!cameraView.videoWidth || !cameraView.videoHeight) {
    console.error("Camera view is not ready or has zero dimensions.");
    showToast("Camera is not ready, please try again.", "error");
    return;
  }

  const ctx = canvas.getContext("2d");
  canvas.width  = cameraView.videoWidth;
  canvas.height = cameraView.videoHeight;
  ctx.drawImage(cameraView, 0, 0, canvas.width, canvas.height);

  const dataUrl = canvas.toDataURL("image/jpeg", 0.9);
  if (!dataUrl || dataUrl === "data:,") {
    console.error("Failed to create data URL from canvas.");
    showToast("Failed to capture photo. Please try again.", "error");
    closeModal();
    return;
  }

  addImageToPreview(dataUrl);
  closeModal();
}



// ─────────────────────────────────────────────────────────────────────────────
// handleFileSelect(e)
// Reads <input type="file"> selection, enforces 5-image limit, converts each
// file to dataURL, and previews them.
// ─────────────────────────────────────────────────────────────────────────────
function handleFileSelect(e) {
  const files          = e.target.files;
  const remainingSlots = 5 - selectedImages.length;

  if (files.length > remainingSlots) {
    showToast(`You can only add ${remainingSlots} more image(s)`, "warning");
    return;
  }

  for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
    const file = files[i];
    if (file.type.match("image.*")) {
      const reader = new FileReader();
      reader.onload = (evt) => addImageToPreview(evt.target.result);
      reader.readAsDataURL(file);
    }
  }

  fileInput.value = ""; // reset so same file can be chosen again later
}



// ─────────────────────────────────────────────────────────────────────────────
// addImageToPreview(imageUrl)
// Adds a thumbnail + remove-button to #image-preview div and pushes to state.
// ─────────────────────────────────────────────────────────────────────────────
function addImageToPreview(imageUrl) {
  if (selectedImages.length >= 5) {
    showToast("Maximum of 5 images reached", "warning");
    return;
  }

  selectedImages.push(imageUrl);

  const img        = document.createElement("img");
  img.src          = imageUrl;
  img.className    = "image-preview";

  const removeBtn  = document.createElement("button");
  removeBtn.innerHTML = "&times;";
  removeBtn.className  = "remove-image-btn";
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const idx = Array.from(imagePreview.children).indexOf(e.target.parentElement);
    selectedImages.splice(idx, 1);
    imagePreview.removeChild(e.target.parentElement);
  });

  const container = document.createElement("div");
  container.className = "image-preview-container";
  container.appendChild(img);
  container.appendChild(removeBtn);

  imagePreview.appendChild(container);
}



// ─────────────────────────────────────────────────────────────────────────────
// openLocationPicker()
// Shows modal & initialises its embedded map.
// ─────────────────────────────────────────────────────────────────────────────
function openLocationPicker() {
  locationModal.style.display = "flex";
  initLocationMap();
}



// ─────────────────────────────────────────────────────────────────────────────
// confirmLocation()
// Reads marker position from locationMap, stores it in state, updates text.
// ─────────────────────────────────────────────────────────────────────────────
function confirmLocation() {
  const marker          = locationMap._layers[Object.keys(locationMap._layers)[1]];
  currentLocation       = marker.getLatLng();
  locationDisplay.textContent = `Location: Lat ${currentLocation.lat.toFixed(4)}, Lng ${currentLocation.lng.toFixed(4)}`;
  closeModal();
}



// ─────────────────────────────────────────────────────────────────────────────
// submitReport(e)
// Validates inputs, creates thumbnails, builds report object, saves to LS & UI.
// ─────────────────────────────────────────────────────────────────────────────
function submitReport(e) {
  e.preventDefault();

  if (!currentLocation)          { showToast("Please select a location for the issue", "warning"); return; }
  if (!selectedImages.length)    { showToast("Please add at least one photo of the issue", "warning"); return; }

  const thumbPromises = selectedImages.map((img) => createThumbnail(img, 100, 100));

  Promise.all(thumbPromises).then((thumbnails) => {
    const report = {
      id         : Date.now(),
      title      : document.getElementById("issue-title").value,
      category   : document.getElementById("issue-category").value,
      description: document.getElementById("issue-description").value,
      location   : currentLocation,
      images     : selectedImages,
      thumbnails : thumbnails,
      status     : "submitted",
      date       : new Date().toISOString(),
    };

    saveReport(report);                // persist + add to map

    // reset form & UI
    reportForm.reset();
    imagePreview.innerHTML = "";
    selectedImages = [];
    currentLocation = null;
    locationDisplay.textContent = "Location: Not selected";

    navigateTo("my-reports");
    showToast("Report submitted successfully!", "success");
    showSubmitAnimation();
  });
}



// ─────────────────────────────────────────────────────────────────────────────
// showSubmitAnimation()
// Quick SVG checkmark overlay for user feedback after submit.
// ─────────────────────────────────────────────────────────────────────────────
function showSubmitAnimation() {
  const overlay = document.createElement("div");
  overlay.className = "submit-animation-overlay";
  overlay.innerHTML = `
    <div class="submit-animation-checkmark">
      <svg viewBox="0 0 52 52">
        <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
        <path   class="checkmark-check"  fill="none" d="M14 27l7 7 16-16"/>
      </svg>
      <div class="submit-animation-text">Report Submitted!</div>
    </div>`;
  document.body.appendChild(overlay);

  setTimeout(() => {
    overlay.classList.add("hide");
    setTimeout(() => overlay.remove(), 600);
  }, 1200);
}



// ─────────────────────────────────────────────────────────────────────────────
// createThumbnail(src, w, h)
// Returns a Promise resolving to a resized dataURL (JPEG) for map pop-ups.
// ─────────────────────────────────────────────────────────────────────────────
function createThumbnail(imageSrc, width, height) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src   = imageSrc;
    img.onload = () => {
      const c   = document.createElement("canvas");
      const ctx = c.getContext("2d");
      c.width   = width;
      c.height  = height;

      const ratio      = Math.min(width / img.width, height / img.height);
      const newW       = img.width  * ratio;
      const newH       = img.height * ratio;
      const x          = (width  - newW) / 2;
      const y          = (height - newH) / 2;

      ctx.drawImage(img, x, y, newW, newH);
      resolve(c.toDataURL("image/jpeg"));
    };
  });
}



// ─────────────────────────────────────────────────────────────────────────────
// Local-storage Helpers (saveReport / loadReports / updateAllReports)
// ─────────────────────────────────────────────────────────────────────────────
function saveReport(report) {
  const stored   = localStorage.getItem("umt-facility-reports");
  const arr      = stored ? JSON.parse(stored) : [];
  arr.push(report);
  reports = arr;
  localStorage.setItem("umt-facility-reports", JSON.stringify(arr));
  addReportToMap(report); // immediate visual feedback
}

function loadReports() {
  const stored = localStorage.getItem("umt-facility-reports");
  if (stored) reports = JSON.parse(stored);
}

function updateAllReports() {
  localStorage.setItem("umt-facility-reports", JSON.stringify(reports));
}



// ─────────────────────────────────────────────────────────────────────────────
// Map Marker Rendering (loadReportsOnMap / addReportToMap)
// ─────────────────────────────────────────────────────────────────────────────
function loadReportsOnMap() {
  if (map) {
    map.eachLayer((layer) => { if (layer instanceof L.Marker) map.removeLayer(layer); });
  }
  reports.forEach(addReportToMap);
}

function addReportToMap(report) {
  const pinColor = categoryColors[report.category] || categoryColors.other;

  const iconHtml = `
    <div class="map-marker-container">
      <img src="${report.images[0]}" class="map-marker-image">
      <div class="map-marker-pin" style="background-color:${pinColor};"></div>
    </div>`;

  const marker = L.marker([report.location.lat, report.location.lng], {
    icon: L.divIcon({ html:iconHtml, iconSize:[40,50], className:"custom-marker-icon" }),
  }).addTo(map);

  let popup = `
    <div class="map-popup">
      <h4>${report.title}</h4>
      <p><strong>Category:</strong> ${report.category}</p>
      <p><strong>Status:</strong> ${report.status.replace("-"," ")}</p>
      <div class="popup-images">`;

  report.images.forEach((img) => {
    popup += `<img src="${img}" class="popup-image" onclick="viewImageInModal('${img}')">`;
  });

  popup += `
      </div>
      <button onclick="viewReportDetails(${report.id})" class="popup-details-btn">View Details</button>
    </div>`;

  marker.bindPopup(popup, { maxWidth:300, minWidth:200 });
}



// ─────────────────────────────────────────────────────────────────────────────
// renderReportsList(filter)
// Builds "My Reports" cards; supports status filtering.
// ─────────────────────────────────────────────────────────────────────────────
function renderReportsList(filter = "all") {
  reportsList.innerHTML = "";
  const filtered = filter === "all" ? reports : reports.filter((r) => r.status === filter);

  if (!filtered.length) { reportsList.innerHTML = "<p>No reports found</p>"; return; }

  filtered.forEach((report) => {
    const card = document.createElement("div");
    card.className = "report-card";

    // map status → optional coloured CSS class
    const statusCls = {
      "submitted":   "status-submitted",
      "in-progress": "status-in-progress",
      "resolved":    "status-resolved",
    }[report.status] || "";

    card.innerHTML = `
      <div class="report-header">
        <div class="report-title">${report.title}</div>
        <div class="report-status ${statusCls}">${report.status.replace("-"," ")}</div>
      </div>
      <div class="report-category">${report.category}</div>
      <div class="report-images">
        ${report.images.slice(0,3).map((img)=>
           `<img src="${img}" class="report-thumbnail" onclick="viewImageInModal('${img}')">`).join("")}
        ${report.images.length>3 ? `<div>+${report.images.length-3} more</div>` : ""}
      </div>
      <div class="report-footer">
        <div>${new Date(report.date).toLocaleDateString()}</div>
        <button class="view-details-btn" onclick="viewReportDetails(${report.id})">View Details</button>
      </div>`;
    reportsList.appendChild(card);
  });
}



// ─────────────────────────────────────────────────────────────────────────────
// filterReports(status)
// Visually toggles active button & re-renders list.
// ─────────────────────────────────────────────────────────────────────────────
function filterReports(status) {
  filterBtns.forEach((btn) => {
    btn.classList.toggle("active", btn.getAttribute("data-status") === status);
  });
  renderReportsList(status);
}



// ─────────────────────────────────────────────────────────────────────────────
// renderGallery()
// Simple photo wall across all reports.
// ─────────────────────────────────────────────────────────────────────────────
function renderGallery() {
  galleryContainer.innerHTML = "";

  if (!reports.length) { galleryContainer.innerHTML = "<p>No photos available</p>"; return; }

  reports.forEach((r) =>
    r.images.forEach((img) => {
      const item = document.createElement("div");
      item.className = "gallery-item";
      item.innerHTML = `<img src="${img}" onclick="viewImageInModal('${img}')">`;
      galleryContainer.appendChild(item);
    })
  );
}



// ─────────────────────────────────────────────────────────────────────────────
// viewImageInModal(url) / viewReportDetails(id)
// Open image or full-report modal overlays.
// ─────────────────────────────────────────────────────────────────────────────
function viewImageInModal(imageUrl) {
  reportDetailsContent.innerHTML = `<img src="${imageUrl}" style="max-width:100%; max-height:80vh;">`;
  reportDetailsModal.style.display = "flex";
}

function viewReportDetails(id) {
  const report = reports.find((r) => r.id === id);
  if (!report) return;

  const date = new Date(report.date);

  reportDetailsContent.innerHTML = `
    <div class="report-details">
      <h4>${report.title}</h4>
      <p><strong>Category:</strong> ${report.category}</p>
      <p><strong>Status:</strong> <span class="status-${report.status.replace("-","")}">${report.status.replace("-"," ")}</span></p>
      <p><strong>Date Reported:</strong> ${date.toLocaleDateString()} ${date.toLocaleTimeString()}</p>
      <p><strong>Location:</strong> Lat ${report.location.lat.toFixed(4)}, Lng ${report.location.lng.toFixed(4)}</p>
      <p><strong>Description:</strong></p>
      <p>${report.description || "No description provided"}</p>

      <div class="report-images-grid">
        ${report.images.map((img)=>
          `<img src="${img}" onclick="viewImageInModal('${img}')" style="max-width:100px; max-height:100px; margin:5px; cursor:pointer;">`).join("")}
      </div>

      <div class="status-updater">
        <hr>
        <h4>Update Report Status (Demo)</h4>
        <select id="status-selector">
          <option value="submitted"   ${report.status==="submitted"   ?"selected":""}>Submitted</option>
          <option value="in-progress" ${report.status==="in-progress" ?"selected":""}>In Progress</option>
          <option value="resolved"    ${report.status==="resolved"    ?"selected":""}>Resolved</option>
        </select>
        <button id="update-status-button">Update</button>
      </div>
    </div>`;

  document.getElementById("update-status-button").addEventListener("click", () => {
    report.status = document.getElementById("status-selector").value;
    updateAllReports();
    renderReportsList();      // refresh list
    closeModal();
    showToast("Report status updated successfully!", "success");
  });

  reportDetailsModal.style.display = "flex";
}



// ─────────────────────────────────────────────────────────────────────────────
// checkPWAInstallPrompt()
// Shows a custom banner encouraging user to add to home-screen.
// Includes a 5-second auto-dismiss countdown.
// ─────────────────────────────────────────────────────────────────────────────
function checkPWAInstallPrompt() {
  let deferredPrompt;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();                 // block native prompt
    if (document.getElementById("install-prompt")) return; // already shown
    deferredPrompt = e;

    const banner = document.createElement("div");
    banner.id    = "install-prompt";
    banner.innerHTML = `
      <span>Install UMT Facility Feedback Reporter for a better experience</span>
      <div class="install-prompt-actions">
        <span class="prompt-countdown" id="prompt-countdown"></span>
        <button id="install-btn">Install</button>
        <button id="close-prompt-btn" aria-label="Close">&times;</button>
      </div>`;
    document.body.appendChild(banner);
    setTimeout(() => banner.classList.add("show"), 100); // slide-in

    const countdownEl = document.getElementById("prompt-countdown");
    let countdown = 5;

    const startCountdown = () => {
      countdownEl.textContent = `(Closing in ${countdown}...)`;
      const int = setInterval(() => {
        countdown--;
        if (countdown > 0) {
          countdownEl.textContent = `(Closing in ${countdown}...)`;
        } else {
          clearInterval(int);
          banner.classList.remove("show");
          setTimeout(() => banner.remove(), 500);
        }
      }, 1000);
      return int;
    };

    const timer = startCountdown();

    document.getElementById("install-btn").addEventListener("click", () => {
      clearInterval(timer);
      banner.remove();
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choice) => {
        console.log(`User ${choice.outcome === "accepted" ? "accepted" : "dismissed"} the install prompt`);
        deferredPrompt = null;
      });
    });

    document.getElementById("close-prompt-btn").addEventListener("click", () => {
      clearInterval(timer);
      banner.remove();
    });
  });
}



// ─────────────────────────────────────────────────────────────────────────────
// Global Exports (for HTML inline onclick handlers)
// ─────────────────────────────────────────────────────────────────────────────
window.viewReportDetails = viewReportDetails;
window.viewImageInModal  = viewImageInModal;



// ─────────────────────────────────────────────────────────────────────────────
// Boot-strapping calls
// ─────────────────────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", initApp);

// (duplicate listener kept – original logic preserved)
document.getElementById("refresh-map-btn").addEventListener("click", loadReportsOnMap);



// ─────────────────────────────────────────────────────────────────────────────
// showToast(message, type)
// Small wrapper around Toastify to standardise colours & placement.
// Types: success | error | warning | info
// ─────────────────────────────────────────────────────────────────────────────
function showToast(message, type = "info") {
  Toastify({
    text    : message,
    duration: 3000,
    gravity : "top",
    position: "right",
    style   : {
      background:
        type === "success" ? "#27ae60" :
        type === "error"   ? "#e74c3c" :
        type === "warning" ? "#f39c12" :
                             "#3498db",
    },
    stopOnFocus: true,
    close      : true,
  }).showToast();
}
