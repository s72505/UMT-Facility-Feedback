// Service Worker Registration
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register("sw.js")
      .then((registration) => {
        console.log("ServiceWorker registration successful");
      })
      .catch((err) => {
        console.log("ServiceWorker registration failed: ", err);
      });
  });
}

// DOM Elements
const pages = document.querySelectorAll(".page");
const navLinks = document.querySelectorAll(".nav-link");
const menuBtn = document.getElementById("menu-btn");
const closeNavBtn = document.getElementById("close-nav-btn");
const sideNav = document.getElementById("side-nav");
const mapView = document.getElementById("map-view");
const reportIssuePage = document.getElementById("report-issue");
const myReportsPage = document.getElementById("my-reports");
const galleryPage = document.getElementById("gallery");
const aboutPage = document.getElementById("about");
const newReportBtn = document.getElementById("new-report-btn");
const currentLocationBtn = document.getElementById("current-location-btn");
const reportForm = document.getElementById("report-form");
const imagePreview = document.getElementById("image-preview");
const cameraBtn = document.getElementById("camera-btn");
const galleryBtn = document.getElementById("gallery-btn");
const fileInput = document.getElementById("file-input");
const selectLocationBtn = document.getElementById("select-location-btn");
const locationDisplay = document.getElementById("location-display");
const reportsList = document.getElementById("reports-list");
const filterBtns = document.querySelectorAll(".filter-btn");
const galleryContainer = document.getElementById("gallery-container");
const cameraModal = document.getElementById("camera-modal");
const closeModalBtns = document.querySelectorAll(".close-modal");
const cameraView = document.getElementById("camera-view");
const captureBtn = document.getElementById("capture-btn");
const canvas = document.getElementById("canvas");
const locationModal = document.getElementById("location-modal");
const locationMapElement = document.getElementById("location-map");
const confirmLocationBtn = document.getElementById("confirm-location-btn");
const reportDetailsModal = document.getElementById("report-details-modal");
const reportDetailsContent = document.getElementById("report-details-content");

// App State
let currentPage = "landing-page";
let currentLocation = null;
let selectedImages = [];
let reports = [];
let map, locationMap;
let stream = null;

// Initialize the app
function initApp() {
  setupEventListeners();
  initMap();
  loadReports();
  checkGeolocation();
  checkPWAInstallPrompt();
}

// Set up event listeners
function setupEventListeners() {
  // In your setupEventListeners() function:
  document
    .getElementById("refresh-map-btn")
    .addEventListener("click", function () {
      loadReportsOnMap();
      // Optional: Show refresh animation
      this.innerHTML = "⏳";
      setTimeout(() => {
        this.innerHTML = "🔄";
      }, 1000);
    });

  // Navigation
  menuBtn.addEventListener("click", toggleSideNav);
  closeNavBtn.addEventListener("click", toggleSideNav);

  navLinks.forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      const page = link.getAttribute("data-page");
      navigateTo(page);
      toggleSideNav();
    });
  });

  // Landing Page
  document.getElementById("go-to-report").addEventListener("click", () => navigateTo("report-issue"));
  document.getElementById("go-to-map").addEventListener("click", () => navigateTo("map-view"));
  document.getElementById("go-to-my-reports").addEventListener("click", () => navigateTo("my-reports"));

  // Make logo a home button
  document.getElementById("logo-btn").addEventListener("click", () => navigateTo("landing-page"));

  // Make title a home button
  document.getElementById("title-btn").addEventListener("click", () => navigateTo("landing-page"));

  // Map View
  newReportBtn.addEventListener("click", () => navigateTo("report-issue"));
  currentLocationBtn.addEventListener("click", centerMapOnUser);

  // Report Form
  reportForm.addEventListener("submit", submitReport);
  cameraBtn.addEventListener("click", openCamera);
  galleryBtn.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", handleFileSelect);
  selectLocationBtn.addEventListener("click", openLocationPicker);

  // Camera
  captureBtn.addEventListener("click", capturePhoto);
  closeModalBtns.forEach((btn) => {
    btn.addEventListener("click", closeModal);
  });

  // Location Picker
  confirmLocationBtn.addEventListener("click", confirmLocation);

  // Reports List
  filterBtns.forEach((btn) => {
    btn.addEventListener("click", () =>
      filterReports(btn.getAttribute("data-status"))
    );
  });
}

// Initialize main map
function initMap() {
  // Default to UMT coordinates (example)
  const umtCoordinates = [5.4072, 103.0883];

  map = L.map("map").setView(umtCoordinates, 16);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(map);

  // Add click handler for map
  map.on("click", (e) => {
    if (currentPage === "map-view") {
      const marker = L.marker(e.latlng)
        .addTo(map)
        .bindPopup(
          `<b>New Report Location</b><br>Lat: ${e.latlng.lat.toFixed(
            4
          )}, Lng: ${e.latlng.lng.toFixed(4)}`
        )
        .openPopup();
    }
  });

  // Load any existing reports on the map
  loadReportsOnMap();
}

// Initialize location picker map
function initLocationMap() {
  const currentCenter = currentLocation || map.getCenter();
  locationMap = L.map("location-map").setView(currentCenter, 18);

  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "© OpenStreetMap contributors",
  }).addTo(locationMap);

  let marker = L.marker(currentCenter, {
    draggable: true,
  }).addTo(locationMap);

  if (!currentLocation) {
    marker.bindPopup("Drag to select location").openPopup();
  }

  locationMap.on("click", (e) => {
    marker.setLatLng(e.latlng);
  });
}

// Center map on user's location
function centerMapOnUser() {
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const userLocation = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        };
        map.setView(userLocation, 18);
        L.marker(userLocation)
          .addTo(map)
          .bindPopup("Your current location")
          .openPopup();
      },
      (error) => {
        showToast("Unable to get your location: " + error.message, "error");
      }
    );
  } else {
    showToast("Geolocation is not supported by your browser", "error");
  }
}

// Check geolocation permissions
function checkGeolocation() {
  if (navigator.permissions) {
    navigator.permissions
      .query({ name: "geolocation" })
      .then((permissionStatus) => {
        if (permissionStatus.state === "granted") {
          centerMapOnUser();
        }
      });
  }
}

// Navigate between pages
function navigateTo(page) {
  // Hide all pages
  pages.forEach((p) => p.classList.remove("active-page"));

  // Show selected page
  const targetPage = document.getElementById(page);
  if (targetPage) {
    targetPage.classList.add("active-page");
  }

  // Update active nav link
  navLinks.forEach((link) => {
    link.classList.remove("active");
    if (link.getAttribute("data-page") === page) {
      link.classList.add("active");
    }
  });

  currentPage = page;

  // Special handling for certain pages
  if (page === "gallery") {
    renderGallery();
  } else if (page === "my-reports") {
    renderReportsList();
  } else if (page === "map-view" && map) {
    // Add a small delay to ensure the map container is fully visible before resizing
    setTimeout(function () {
      map.invalidateSize();
    }, 100);
  }
}

// Toggle side navigation
function toggleSideNav() {
  sideNav.classList.toggle("active");
}

// Open camera modal
function openCamera() {
  cameraModal.style.display = "flex";

  navigator.mediaDevices
    .getUserMedia({ video: true })
    .then((mediaStream) => {
      stream = mediaStream;
      cameraView.srcObject = stream;
    })
    .catch((err) => {
      console.error("Error accessing camera:", err);
      showToast(
        "Could not access the camera. Please check permissions.",
        "error"
      );
    });
}

// Close any modal
function closeModal() {
  document.querySelectorAll(".modal").forEach((modal) => {
    modal.style.display = "none";
  });

  // Stop camera stream if it's running
  if (stream) {
    stream.getTracks().forEach((track) => track.stop());
    stream = null;
    cameraView.srcObject = null;
  }
}

// Capture photo from camera
function capturePhoto() {
  const context = canvas.getContext("2d");
  canvas.width = cameraView.videoWidth;
  canvas.height = cameraView.videoHeight;
  context.drawImage(cameraView, 0, 0, canvas.width, canvas.height);

  canvas.toBlob(
    (blob) => {
      const imageUrl = URL.createObjectURL(blob);
      addImageToPreview(imageUrl);
      closeModal();
    },
    "image/jpeg",
    0.9
  );
}

// Handle file selection from gallery
function handleFileSelect(e) {
  const files = e.target.files;

  // Limit to 5 images total
  const remainingSlots = 5 - selectedImages.length;
  if (files.length > remainingSlots) {
    showToast(`You can only add ${remainingSlots} more image(s)`, "warning");
    return;
  }

  for (let i = 0; i < Math.min(files.length, remainingSlots); i++) {
    const file = files[i];
    if (file.type.match("image.*")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        addImageToPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    }
  }

  // Reset file input
  fileInput.value = "";
}

// Add image to preview
function addImageToPreview(imageUrl) {
  if (selectedImages.length >= 5) {
    showToast("Maximum of 5 images reached", "warning");
    return;
  }

  selectedImages.push(imageUrl);

  // Create image preview element
  const img = document.createElement("img");
  img.src = imageUrl;
  img.className = "image-preview";

  // Create remove button
  const removeBtn = document.createElement("button");
  removeBtn.innerHTML = "&times;";
  removeBtn.className = "remove-image-btn";
  removeBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    const index = Array.from(imagePreview.children).indexOf(
      e.target.parentElement
    );
    selectedImages.splice(index, 1);
    imagePreview.removeChild(e.target.parentElement);
  });

  // Create container
  const container = document.createElement("div");
  container.className = "image-preview-container";
  container.appendChild(img);
  container.appendChild(removeBtn);

  imagePreview.appendChild(container);
}

// Open location picker modal
function openLocationPicker() {
  locationModal.style.display = "flex";
  initLocationMap();
}

// Confirm location selection
function confirmLocation() {
  const marker = locationMap._layers[Object.keys(locationMap._layers)[1]];
  currentLocation = marker.getLatLng();
  locationDisplay.textContent = `Location: Lat ${currentLocation.lat.toFixed(
    4
  )}, Lng ${currentLocation.lng.toFixed(4)}`;
  closeModal();
}

// Submit report form
function submitReport(e) {
  e.preventDefault();

  if (!currentLocation) {
    showToast("Please select a location for the issue", "warning");
    return;
  }

  if (selectedImages.length === 0) {
    showToast("Please add at least one photo of the issue", "warning");
    return;
  }

  // Create a smaller thumbnail for the map marker
  const thumbnailPromises = selectedImages.map((img) => {
    return createThumbnail(img, 100, 100);
  });

  Promise.all(thumbnailPromises).then((thumbnails) => {
    const report = {
      id: Date.now(),
      title: document.getElementById("issue-title").value,
      category: document.getElementById("issue-category").value,
      description: document.getElementById("issue-description").value,
      location: currentLocation,
      images: selectedImages,
      thumbnails: thumbnails, // Store thumbnails separately
      status: "submitted",
      date: new Date().toISOString(),
    };

    // Save report
    saveReport(report);

    // Reset form
    reportForm.reset();
    imagePreview.innerHTML = "";
    selectedImages = [];
    currentLocation = null;
    locationDisplay.textContent = "Location: Not selected";

    // Navigate to reports list
    navigateTo("my-reports");
    // Show success message
    showToast("Report submitted successfully!", "success");
    showSubmitAnimation();
  });
}

// Show submission animation
function showSubmitAnimation() {
  // Create overlay
  const overlay = document.createElement("div");
  overlay.className = "submit-animation-overlay";
  overlay.innerHTML = `
    <div class="submit-animation-checkmark">
      <svg viewBox="0 0 52 52">
        <circle class="checkmark-circle" cx="26" cy="26" r="25" fill="none"/>
        <path class="checkmark-check" fill="none" d="M14 27l7 7 16-16"/>
      </svg>
      <div class="submit-animation-text">Report Submitted!</div>
    </div>
  `;
  document.body.appendChild(overlay);
  setTimeout(() => {
    overlay.classList.add("hide");
    setTimeout(() => overlay.remove(), 600);
  }, 1200);
}

// Helper function to create thumbnails
function createThumbnail(imageSrc, width, height) {
  return new Promise((resolve) => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = width;
      canvas.height = height;

      // Calculate ratios
      const ratio = Math.min(width / img.width, height / img.height);
      const newWidth = img.width * ratio;
      const newHeight = img.height * ratio;
      const x = (width - newWidth) / 2;
      const y = (height - newHeight) / 2;

      ctx.drawImage(img, x, y, newWidth, newHeight);
      resolve(canvas.toDataURL("image/jpeg"));
    };
  });
}

// Save report to storage
function saveReport(report) {
  // Always reload the latest reports from localStorage before saving
  const savedReports = localStorage.getItem("umt-facility-reports");
  let reportsArr = [];
  if (savedReports) {
    reportsArr = JSON.parse(savedReports);
  }
  reportsArr.push(report);
  reports = reportsArr;
  localStorage.setItem("umt-facility-reports", JSON.stringify(reportsArr));
  addReportToMap(report);
}

// Load reports from storage
function loadReports() {
  const savedReports = localStorage.getItem("umt-facility-reports");
  if (savedReports) {
    reports = JSON.parse(savedReports);
  }
}

// Load reports onto the map
function loadReportsOnMap() {
  // Clear existing markers first
  if (map) {
    map.eachLayer((layer) => {
      if (layer instanceof L.Marker) {
        map.removeLayer(layer);
      }
    });
  }

  // Add all reports to the map
  reports.forEach((report) => {
    addReportToMap(report);
  });
}

// Add a report to the map
function addReportToMap(report) {
  // Create a custom icon with the first image as a thumbnail
  const iconHtml = `
    <div class="map-marker-container">
      <img src="${report.images[0]}" class="map-marker-image">
      <div class="map-marker-pin"></div>
    </div>
  `;

  const marker = L.marker([report.location.lat, report.location.lng], {
    icon: L.divIcon({
      html: iconHtml,
      iconSize: [40, 50], // Width, height
      className: "custom-marker-icon",
    }),
  }).addTo(map);

  // Set status color for the pin
  let statusColor;
  switch (report.status) {
    case "submitted":
      statusColor = "#f39c12";
      break;
    case "in-progress":
      statusColor = "#3498db";
      break;
    case "resolved":
      statusColor = "#2ecc71";
      break;
    default:
      statusColor = "#7f8c8d";
  }

  // Update popup content to show all images
  let popupContent = `
    <div class="map-popup">
      <h4>${report.title}</h4>
      <p><strong>Category:</strong> ${report.category}</p>
      <p><strong>Status:</strong> <span style="color:${statusColor}">${report.status.replace(
    "-",
    " "
  )}</span></p>
      <div class="popup-images">
  `;

  report.images.forEach((img) => {
    popupContent += `<img src="${img}" class="popup-image" onclick="viewImageInModal('${img}')">`;
  });

  popupContent += `
      </div>
      <button onclick="viewReportDetails(${report.id})" class="popup-details-btn">
        View Details
      </button>
    </div>
  `;

  marker.bindPopup(popupContent, {
    maxWidth: 300,
    minWidth: 200,
  });

  // Store marker reference in the report object
  report.marker = marker;
}
// Render reports list
function renderReportsList(filter = "all") {
  reportsList.innerHTML = "";

  const filteredReports =
    filter === "all" ? reports : reports.filter((r) => r.status === filter);

  if (filteredReports.length === 0) {
    reportsList.innerHTML = "<p>No reports found</p>";
    return;
  }

  filteredReports.forEach((report) => {
    const reportCard = document.createElement("div");
    reportCard.className = "report-card";

    let statusClass;
    switch (report.status) {
      case "submitted":
        statusClass = "status-submitted";
        break;
      case "in-progress":
        statusClass = "status-in-progress";
        break;
      case "resolved":
        statusClass = "status-resolved";
        break;
      default:
        statusClass = "";
    }

    reportCard.innerHTML = `
      <div class="report-header">
        <div class="report-title">${report.title}</div>
        <div class="report-status ${statusClass}">${report.status.replace(
      "-",
      " "
    )}</div>
      </div>
      <div class="report-category">${report.category}</div>
      <div class="report-images">
        ${report.images
          .slice(0, 3)
          .map(
            (img) =>
              `<img src="${img}" class="report-thumbnail" onclick="viewImageInModal('${img}')">`
          )
          .join("")}
        ${
          report.images.length > 3
            ? `<div>+${report.images.length - 3} more</div>`
            : ""
        }
      </div>
      <div class="report-footer">
        <div>${new Date(report.date).toLocaleDateString()}</div>
        <button class="view-details-btn" onclick="viewReportDetails(${
          report.id
        })">View Details</button>
      </div>
    `;

    reportsList.appendChild(reportCard);
  });
}

// Filter reports by status
function filterReports(status) {
  // Update active filter button
  filterBtns.forEach((btn) => {
    btn.classList.remove("active");
    if (btn.getAttribute("data-status") === status) {
      btn.classList.add("active");
    }
  });

  renderReportsList(status);
}

// Render photo gallery
function renderGallery() {
  galleryContainer.innerHTML = "";

  if (reports.length === 0) {
    galleryContainer.innerHTML = "<p>No photos available</p>";
    return;
  }

  reports.forEach((report) => {
    report.images.forEach((img) => {
      const galleryItem = document.createElement("div");
      galleryItem.className = "gallery-item";
      galleryItem.innerHTML = `<img src="${img}" onclick="viewImageInModal('${img}')">`;
      galleryContainer.appendChild(galleryItem);
    });
  });
}

// View image in modal
function viewImageInModal(imageUrl) {
  reportDetailsContent.innerHTML = `<img src="${imageUrl}" style="max-width:100%; max-height:80vh;">`;
  reportDetailsModal.style.display = "flex";
}

// View report details
function viewReportDetails(reportId) {
  const report = reports.find((r) => r.id === reportId);
  if (!report) return;

  const date = new Date(report.date);

  reportDetailsContent.innerHTML = `
    <div class="report-details">
      <h4>${report.title}</h4>
      <p><strong>Category:</strong> ${report.category}</p>
      <p><strong>Status:</strong> <span class="status-${report.status.replace(
        "-",
        ""
      )}">${report.status.replace("-", " ")}</span></p>
      <p><strong>Date Reported:</strong> ${date.toLocaleDateString()} ${date.toLocaleTimeString()}</p>
      <p><strong>Location:</strong> Lat ${report.location.lat.toFixed(
        4
      )}, Lng ${report.location.lng.toFixed(4)}</p>
      <p><strong>Description:</strong></p>
      <p>${report.description || "No description provided"}</p>
      
      <div class="report-images-grid">
        ${report.images
          .map(
            (img) =>
              `<img src="${img}" onclick="viewImageInModal('${img}')" style="max-width:100px; max-height:100px; margin:5px; cursor:pointer;">`
          )
          .join("")}
      </div>
    </div>
  `;

  reportDetailsModal.style.display = "flex";
}

// Check for PWA install prompt
function checkPWAInstallPrompt() {
  let deferredPrompt;

  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e;

    const installPrompt = document.createElement("div");
    installPrompt.id = "install-prompt";
    installPrompt.innerHTML = `
      <div>Install UMT Facility Reporter for better experience</div>
      <button id="install-btn">Install</button>
    `;
    document.body.appendChild(installPrompt);

    document.getElementById("install-btn").addEventListener("click", () => {
      deferredPrompt.prompt();
      deferredPrompt.userChoice.then((choiceResult) => {
        if (choiceResult.outcome === "accepted") {
          console.log("User accepted install");
        } else {
          console.log("User dismissed install");
        }
        deferredPrompt = null;
        installPrompt.remove();
      });
    });

    setTimeout(() => {
      installPrompt.classList.add("show");
    }, 1000);
  });
}

// Make functions available globally for HTML onclick attributes
window.viewReportDetails = viewReportDetails;
window.viewImageInModal = viewImageInModal;

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", initApp);

// Add to setupEventListeners()
document
  .getElementById("refresh-map-btn")
  .addEventListener("click", loadReportsOnMap);

function showToast(message, type = "info") {
  Toastify({
    text: message,
    duration: 3000,
    gravity: "top",
    position: "right",
    backgroundColor:
      type === "success"
        ? "#27ae60"
        : type === "error"
        ? "#e74c3c"
        : type === "warning"
        ? "#f39c12"
        : "#3498db",
    stopOnFocus: true,
    close: true,
  }).showToast();
}
