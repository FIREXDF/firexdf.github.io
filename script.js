const WINDOWS = {};
let zIndex = 10;
let activeWindowId = null;
const isMobile = window.matchMedia("(max-width: 768px)").matches;
const WALLPAPER_STORAGE_KEY = "firexdf-selected-wallpaper";
const WALLPAPER_MODE_KEY = "firexdf-wallpaper-mode";
const WALLPAPER_MANIFEST_URL = "./img/background/backgrounds.json";
const DEFAULT_WALLPAPER = "./img/background/default-desktop.png";
let wallpapers = [];
let activeWallpaperPath = DEFAULT_WALLPAPER;

function initLoadingScreen() {
  const loadingScreen = document.getElementById("loadingScreen");
  const desktop = document.getElementById("desktop");

  setTimeout(() => {
    loadingScreen.classList.add("fade-out");

    setTimeout(() => {
      loadingScreen.style.display = "none";
      desktop.classList.add("visible");
      initBootAnimation();
    }, 600);
  }, 2000);
}

function initWindows() {
  document.querySelectorAll(".win7-window").forEach((win) => {
    const id = win.id;
    const titleText = win.querySelector(".title-bar-text").textContent;

    WINDOWS[id] = {
      element: win,
      title: titleText,
      minimized: false,
    };

    if (!isMobile) makeDraggable(win);
    setupWindowControls(win, id);

    if (win.style.display !== "none" && !isMobile) {
      requestAnimationFrame(() => {
        centerWindow(win);
      });
    }
  });
}

function centerWindow(win) {
  const desktop = document.getElementById("desktop");
  const dw = desktop.offsetWidth;
  const dh = desktop.offsetHeight;
  const ww = win.offsetWidth || 500;
  const wh = win.offsetHeight || 400;
  const offsetX = Math.random() * 60 - 30;
  const offsetY = Math.random() * 40 - 20;
  win.style.left = Math.max(20, (dw - ww) / 2 + offsetX) + "px";
  win.style.top = Math.max(20, (dh - wh) / 2 + offsetY) + "px";
}

function makeDraggable(win) {
  const titleBar = win.querySelector(".title-bar");
  let isDragging = false;
  let startX, startY, origX, origY;

  titleBar.addEventListener("mousedown", (e) => {
    if (e.target.closest(".title-bar-controls")) return;
    isDragging = true;
    startX = e.clientX;
    startY = e.clientY;
    origX = win.offsetLeft;
    origY = win.offsetTop;
    bringToFront(win.id);
    document.body.style.userSelect = "none";
  });

  document.addEventListener("mousemove", (e) => {
    if (!isDragging) return;
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    win.style.left = origX + dx + "px";
    win.style.top = origY + dy + "px";
  });

  document.addEventListener("mouseup", () => {
    isDragging = false;
    document.body.style.userSelect = "";
  });

  win.addEventListener("mousedown", () => {
    bringToFront(win.id);
  });
}

function setupWindowControls(win, id) {
  const controls = win.querySelectorAll(".title-bar-controls button");

  controls.forEach((btn) => {
    const label = btn.getAttribute("aria-label");

    if (label === "Close") {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        if (id === "welcome-window") return;
        closeWindow(id);
      });
    }

    if (label === "Minimize") {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        minimizeWindow(id);
      });
    }

    if (label === "Maximize") {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const desktop = document.getElementById("desktop");
        win.style.left = "0px";
        win.style.top = "0px";
        win.style.width = desktop.offsetWidth + "px";
        win.style.height = desktop.offsetHeight + "px";
      });
    }
  });
}

function openWindow(id) {
  const data = WINDOWS[id];
  if (!data) return;

  const win = data.element;

  if (data.minimized) {
    data.minimized = false;
    win.style.display = "";
    gsap.fromTo(win,
      { opacity: 0, scale: 0.85, y: 40 },
      {
        opacity: 1, scale: 1, y: 0,
        duration: 0.3,
        ease: "power2.out",
        onComplete: () => {
          if (isMobile) win.scrollIntoView({ behavior: "smooth", block: "center" });
        },
      }
    );
    bringToFront(id);
    return;
  }

  if (win.style.display === "none") {
    win.style.display = "";
    if (!isMobile) centerWindow(win);

    gsap.fromTo(win,
      { opacity: 0, scale: 0.8, y: 30 },
      {
        opacity: 1, scale: 1, y: 0,
        duration: 0.35,
        ease: "back.out(1.4)",
        onComplete: () => {
          if (isMobile) win.scrollIntoView({ behavior: "smooth", block: "center" });
        },
      }
    );
  }

  bringToFront(id);
}

function closeWindow(id) {
  const data = WINDOWS[id];
  if (!data) return;

  if (isMobile) {
    const welcome = document.getElementById("welcome-window");
    if (welcome) welcome.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  gsap.to(data.element, {
    opacity: 0,
    scale: 0.85,
    y: 20,
    duration: 0.25,
    ease: "power2.in",
    onComplete: () => {
      const hideDelay = isMobile ? 500 : 0;
      setTimeout(() => {
        data.element.style.display = "none";
        gsap.set(data.element, { clearProps: "opacity,transform,scale" });
      }, hideDelay);
    },
  });
}

function minimizeWindow(id) {
  const data = WINDOWS[id];
  if (!data) return;

  data.minimized = true;

  gsap.to(data.element, {
    opacity: 0,
    scale: 0.7,
    y: 60,
    duration: 0.25,
    ease: "power2.in",
    onComplete: () => {
      data.element.style.display = "none";
      gsap.set(data.element, { clearProps: "opacity,transform,scale" });
    },
  });
}

function bringToFront(id) {
  zIndex++;
  const data = WINDOWS[id];
  if (!data) return;
  data.element.style.zIndex = zIndex;
  activeWindowId = id;

  document.querySelectorAll(".win7-window").forEach((w) => {
    w.classList.toggle("active", w.id === id);
  });
}

function getWallpaperPath(file) {
  if (!file) return DEFAULT_WALLPAPER;
  if (/^(?:\.\/|\/|https?:)/.test(file)) return file;
  return `./img/background/${file}`;
}

function escapeCssUrl(url) {
  return String(url).replace(/"/g, '\\"');
}

function applyWallpaper(path) {
  activeWallpaperPath = path;
  document.body.style.backgroundImage = `url("${escapeCssUrl(path)}")`;
}

function getSavedWallpaper() {
  return localStorage.getItem(WALLPAPER_STORAGE_KEY) || DEFAULT_WALLPAPER;
}

function getWallpaperMode() {
  return localStorage.getItem(WALLPAPER_MODE_KEY) || "random";
}

function setWallpaperMode(mode) {
  localStorage.setItem(WALLPAPER_MODE_KEY, mode);
}

function updateWallpaperStatus(message) {
  const status = document.getElementById("wallpaper-status");
  if (status) status.textContent = message;
}

function normalizeWallpapers(data) {
  const list = Array.isArray(data) ? data : data?.backgrounds;
  if (!Array.isArray(list)) return [];

  const normalized = list
    .map((item, index) => {
      if (typeof item === "string") {
        return {
          name: `Wallpaper ${index + 1}`,
          src: getWallpaperPath(item),
        };
      }

      if (!item?.file && !item?.src) return null;

      return {
        name: item.name || `Wallpaper ${index + 1}`,
        src: getWallpaperPath(item.src || item.file),
      };
    })
    .filter(Boolean);

  const hasDefault = normalized.some((item) => item.src === DEFAULT_WALLPAPER);
  if (!hasDefault) {
    normalized.unshift({
      name: "Default Desktop",
      src: DEFAULT_WALLPAPER,
    });
  }

  return normalized;
}

function saveWallpaper(path) {
  setWallpaperMode("manual");
  localStorage.setItem(WALLPAPER_STORAGE_KEY, path);
  applyWallpaper(path);
  renderWallpaperOptions();
}

function getRandomWallpaper() {
  if (!wallpapers.length) {
    return {
      name: "Default Desktop",
      src: DEFAULT_WALLPAPER,
    };
  }

  const randomIndex = Math.floor(Math.random() * wallpapers.length);
  return wallpapers[randomIndex];
}

function renderWallpaperOptions() {
  const container = document.getElementById("wallpaper-options");
  if (!container) return;

  container.innerHTML = "";

  if (!wallpapers.length) {
    updateWallpaperStatus("No wallpapers found.");
    return;
  }

  const currentWallpaper = activeWallpaperPath;
  const wallpaperMode = getWallpaperMode();
  const activeWallpaper =
    wallpapers.find((item) => item.src === currentWallpaper) ||
    wallpapers.find((item) => item.src === DEFAULT_WALLPAPER) ||
    wallpapers[0];

  wallpapers.forEach((wallpaper) => {
    const card = document.createElement("div");
    card.className = "wallpaper-option";

    if (wallpaper.src === activeWallpaper.src) {
      card.classList.add("active");
    }

    const preview = document.createElement("img");
    preview.className = "wallpaper-preview";
    preview.src = wallpaper.src;
    preview.alt = wallpaper.name;

    const meta = document.createElement("div");
    meta.className = "wallpaper-meta";

    const name = document.createElement("span");
    name.className = "wallpaper-name";
    name.textContent = wallpaper.name;

    const action = document.createElement("button");
    const isActive = wallpaper.src === activeWallpaper.src;
    const isManualSelection = isActive && wallpaperMode === "manual";
    action.textContent = isManualSelection ? "Selected" : isActive ? "Current" : "Apply";
    action.disabled = isManualSelection;
    action.addEventListener("click", () => {
      saveWallpaper(wallpaper.src);
      updateWallpaperStatus(`Wallpaper selected: ${wallpaper.name}`);
    });

    meta.append(name, action);
    card.append(preview, meta);
    container.appendChild(card);
  });

  if (wallpaperMode === "manual") {
    updateWallpaperStatus(`Wallpaper selected: ${activeWallpaper.name}`);
  } else {
    updateWallpaperStatus(`Random wallpaper: ${activeWallpaper.name}`);
  }
}

async function initWallpaperSettings() {
  try {
    const response = await fetch(WALLPAPER_MANIFEST_URL, { cache: "no-store" });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    wallpapers = normalizeWallpapers(data);
  } catch (error) {
    wallpapers = normalizeWallpapers([{ name: "Default Desktop", file: "default-desktop.png" }]);
    updateWallpaperStatus("Wallpaper manifest unavailable, default loaded.");
  }

  const wallpaperMode = getWallpaperMode();
  const savedWallpaper = getSavedWallpaper();
  const savedExists = wallpapers.some((item) => item.src === savedWallpaper);

  if (wallpaperMode === "manual" && savedExists) {
    applyWallpaper(savedWallpaper);
  } else {
    setWallpaperMode("random");
    const randomWallpaper = getRandomWallpaper();
    applyWallpaper(randomWallpaper.src);
  }

  renderWallpaperOptions();

  const resetButton = document.getElementById("btn-reset-wallpaper");
  if (resetButton) {
    resetButton.addEventListener("click", () => {
      setWallpaperMode("random");
      const randomWallpaper = getRandomWallpaper();
      applyWallpaper(randomWallpaper.src);
      renderWallpaperOptions();
      updateWallpaperStatus(`Random wallpaper: ${randomWallpaper.name}`);
    });
  }
}



function initWelcomeButtons() {
  const map = {
    "btn-open-about": "about-window",
    "btn-open-projects": "projects-window",
    "btn-open-contact": "contact-window",
    "btn-open-settings": "settings-window",
  };

  Object.entries(map).forEach(([btnId, winId]) => {
    const btn = document.getElementById(btnId);
    if (btn) {
      btn.addEventListener("click", () => {
        openWindow(winId);
      });
    }
  });
}

function initBootAnimation() {
  const welcomeWin = document.getElementById("welcome-window");

  gsap.fromTo(welcomeWin,
    { opacity: 0, scale: 0.7, y: 50 },
    {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.6,
      ease: "back.out(1.5)",
      delay: 0.1,
    }
  );
}

document.addEventListener("DOMContentLoaded", () => {
  initWindows();
  initWelcomeButtons();
  initWallpaperSettings();
  initLoadingScreen();
});
