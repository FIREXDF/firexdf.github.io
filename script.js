const WINDOWS = {};
let zIndex = 10;
let activeWindowId = null;
const isMobile = window.matchMedia("(max-width: 768px)").matches;
const WALLPAPER_STORAGE_KEY = "firexdf-selected-wallpaper";
const WALLPAPER_MODE_KEY = "firexdf-wallpaper-mode";
const WALLPAPER_MANIFEST_URL = "./img/background/backgrounds.json";
const DEFAULT_WALLPAPER = "./img/background/default-desktop.png";
const SPOTIFY_NOW_PLAYING_ENDPOINT =
  "https://spotify-endpoint-portofolio.vercel.app/api/spotify";
const SPOTIFY_REFRESH_INTERVAL = 30000;
let wallpapers = [];
let activeWallpaperPath = DEFAULT_WALLPAPER;
let spotifyTrackUrl = "https://open.spotify.com/";
let spotifyRefreshTimer = null;
let spotifyProgressTimer = null;
let spotifyPlaybackState = null;
let spotifyEndRefreshPending = false;

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

    if (win.style.display !== "none" && !isMobile && id !== "spotify-window") {
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

function positionSpotifyWindow() {
  if (isMobile) return;

  const win = document.getElementById("spotify-window");
  const welcome = document.getElementById("welcome-window");
  const desktop = document.getElementById("desktop");
  if (!win || !desktop) return;

  const gap = 14;
  win.style.right = "auto";
  win.style.bottom = "auto";

  if (welcome && welcome.style.display !== "none") {
    const left =
      welcome.offsetLeft + (welcome.offsetWidth - win.offsetWidth) / 2;
    const top = welcome.offsetTop - win.offsetHeight - gap;
    win.style.left =
      Math.min(
        Math.max(20, left),
        desktop.offsetWidth - win.offsetWidth - 20,
      ) + "px";
    win.style.top = Math.max(20, top) + "px";
    return;
  }

  win.style.left =
    Math.max(20, (desktop.offsetWidth - win.offsetWidth) / 2) + "px";
  win.style.top = "20px";
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
        if (isMobile) return;
        const desktop = document.getElementById("desktop");
        win.style.left = "0px";
        win.style.top = "0px";
        win.style.width = desktop.offsetWidth + "px";
        win.style.height = desktop.offsetHeight + "px";
      });
    }
  });
}

function getMobileReflowSnapshot(excludedWindow) {
  if (!isMobile) return null;

  const windows = Array.from(document.querySelectorAll(".win7-window")).filter(
    (win) => win !== excludedWindow && win.style.display !== "none",
  );

  return new Map(
    windows.map((win) => [win, win.getBoundingClientRect().top]),
  );
}

function animateMobileReflow(snapshot) {
  if (!snapshot) return;

  snapshot.forEach((oldTop, win) => {
    const newTop = win.getBoundingClientRect().top;
    const delta = oldTop - newTop;
    if (Math.abs(delta) <= 0.5) return;

    gsap.killTweensOf(win);
    gsap.fromTo(
      win,
      { y: delta },
      {
        y: 0,
        duration: 0.24,
        ease: "power1.inOut",
        clearProps: "transform",
      },
    );
  });
}

function openWindow(id) {
  const data = WINDOWS[id];
  if (!data) return;

  const win = data.element;
  gsap.killTweensOf(win);
  data.closing = false;
  gsap.set(win, {
    clearProps: "height,opacity,overflow,transform,scale,filter,pointerEvents",
  });

  if (data.minimized) {
    data.minimized = false;
    const reflowSnapshot = getMobileReflowSnapshot(win);
    win.style.display = "";
    animateMobileReflow(reflowSnapshot);
    gsap.fromTo(
      win,
      { opacity: 0, scale: 0.85, y: 40 },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.3,
        ease: "power2.out",
        onComplete: () => {
          if (isMobile)
            win.scrollIntoView({ behavior: "smooth", block: "center" });
        },
      },
    );
    bringToFront(id);
    return;
  }

  if (win.style.display === "none") {
    const reflowSnapshot = getMobileReflowSnapshot(win);
    win.style.display = "";
    animateMobileReflow(reflowSnapshot);
    if (!isMobile) {
      if (id === "spotify-window") {
        positionSpotifyWindow();
      } else {
        centerWindow(win);
      }
    }

    gsap.fromTo(
      win,
      { opacity: 0, scale: 0.8, y: 30 },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.35,
        ease: "back.out(1.4)",
        onComplete: () => {
          if (isMobile)
            win.scrollIntoView({ behavior: "smooth", block: "center" });
        },
      },
    );
  }

  bringToFront(id);
}

function closeWindow(id) {
  const data = WINDOWS[id];
  if (!data || data.closing) return;

  if (isMobile) {
    data.closing = true;
    const desktop = document.getElementById("desktop");
    const reflowSnapshot = getMobileReflowSnapshot(data.element);

    gsap
      .timeline({
        onStart: () => {
          data.element.style.pointerEvents = "none";
        },
        onComplete: () => {
          data.element.style.display = "none";
          gsap.set(data.element, {
            clearProps:
              "height,opacity,overflow,transform,scale,filter,pointerEvents",
          });
          if (desktop) {
            desktop.scrollTo({ top: 0, behavior: "smooth" });
          }
          data.closing = false;
        },
      })
      .to(data.element, {
        opacity: 0.55,
        filter: "grayscale(1) saturate(0.45)",
        duration: 0.12,
        ease: "power1.out",
      })
      .to(data.element, {
        opacity: 0,
        duration: 0.12,
        ease: "power1.inOut",
      })
      .add(() => {
        data.element.style.display = "none";
        animateMobileReflow(reflowSnapshot);
      });
    return;
  }

  gsap.to(data.element, {
    opacity: 0,
    scale: 0.85,
    y: 20,
    duration: 0.25,
    ease: "power2.in",
    onComplete: () => {
      data.element.style.display = "none";
      gsap.set(data.element, { clearProps: "opacity,transform,scale" });
    },
  });
}

function minimizeWindow(id) {
  const data = WINDOWS[id];
  if (!data || data.closing) return;

  data.minimized = true;

  if (isMobile) {
    data.closing = true;
    const reflowSnapshot = getMobileReflowSnapshot(data.element);

    gsap.to(data.element, {
      opacity: 0,
      duration: 0.16,
      ease: "power1.inOut",
      onComplete: () => {
        data.element.style.display = "none";
        gsap.set(data.element, {
          clearProps:
            "height,opacity,overflow,transform,scale,filter,pointerEvents",
        });
        animateMobileReflow(reflowSnapshot);
        data.closing = false;
      },
    });
    return;
  }

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
    action.textContent = isManualSelection
      ? "Selected"
      : isActive
        ? "Current"
        : "Apply";
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
    wallpapers = normalizeWallpapers([
      { name: "Default Desktop", file: "default-desktop.png" },
    ]);
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

function setSpotifyStatus(message) {
  const status = document.getElementById("spotify-status");
  if (status) status.textContent = message;
}

function formatSpotifyTime(ms) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = String(totalSeconds % 60).padStart(2, "0");
  return `${minutes}:${seconds}`;
}

function updateSpotifyProgress() {
  const progress = document.getElementById("spotify-progress-bar");
  const time = document.getElementById("spotify-time");
  if (!progress || !time) return;

  if (!spotifyPlaybackState || spotifyPlaybackState.durationMs <= 0) {
    progress.style.width = "0%";
    time.textContent = "0:00 / 0:00";
    spotifyEndRefreshPending = false;
    return;
  }

  const elapsed = Date.now() - spotifyPlaybackState.updatedAt;
  const progressMs = Math.min(
    spotifyPlaybackState.durationMs,
    spotifyPlaybackState.progressMs + elapsed,
  );
  const percentage =
    (progressMs / spotifyPlaybackState.durationMs) * 100;

  progress.style.width = `${Math.min(100, Math.max(0, percentage))}%`;
  time.textContent = `${formatSpotifyTime(progressMs)} / ${formatSpotifyTime(
    spotifyPlaybackState.durationMs,
  )}`;

  if (progressMs >= spotifyPlaybackState.durationMs && !spotifyEndRefreshPending) {
    spotifyEndRefreshPending = true;
    refreshSpotifyNowPlaying();
  }
}

function normalizeSpotifyPayload(data) {
  if (!data || data.isPlaying === false || data.is_playing === false) {
    return null;
  }

  const item = data.item || data.track || data;
  const artists = item.artists || data.artists || [];
  const artistNames = Array.isArray(artists)
    ? artists
        .map((artist) => artist.name || artist)
        .filter(Boolean)
        .join(", ")
    : artists;
  const album = item.album || data.album || {};
  const images = album.images || data.images || [];
  const progressMs = data.progress_ms || data.progressMs || 0;
  const durationMs =
    item.duration_ms || data.duration_ms || data.durationMs || 0;

  return {
    title: item.name || data.title || data.song || "Unknown track",
    artist: artistNames || item.artist || data.artist || "Unknown artist",
    cover:
      item.albumImageUrl ||
      data.albumImageUrl ||
      data.cover ||
      data.image ||
      images[0]?.url ||
      "./img/firexdf.png",
    url:
      item.external_urls?.spotify ||
      data.songUrl ||
      data.trackUrl ||
      data.url ||
      "https://open.spotify.com/",
    progress:
      durationMs > 0
        ? Math.min(100, Math.max(0, (progressMs / durationMs) * 100))
        : 0,
    progressMs,
    durationMs,
  };
}

function renderSpotifyTrack(track) {
  const player = document.getElementById("spotify-player");
  const cover = document.getElementById("spotify-cover");
  const stateText = document.getElementById("spotify-state-text");
  const title = document.getElementById("spotify-track");
  const artist = document.getElementById("spotify-artist");
  const progress = document.getElementById("spotify-progress-bar");
  const time = document.getElementById("spotify-time");

  if (!player || !cover || !stateText || !title || !artist || !progress || !time)
    return;

  if (!track) {
    spotifyPlaybackState = null;
    spotifyEndRefreshPending = false;
    player.classList.remove("is-playing");
    cover.src = "./img/firexdf.png";
    stateText.textContent = "Not playing";
    title.textContent = "Not playing anything";
    artist.textContent = "Spotify is inactive";
    progress.style.width = "0%";
    time.textContent = "0:00 / 0:00";
    spotifyTrackUrl = "https://open.spotify.com/";
    setSpotifyStatus("Not playing anything");
    return;
  }

  const isNewTrack = track.url !== spotifyTrackUrl;
  const restartedTrack =
    spotifyPlaybackState && track.progressMs < spotifyPlaybackState.progressMs;

  if (isNewTrack || restartedTrack) {
    spotifyEndRefreshPending = false;
  }

  spotifyPlaybackState = {
    progressMs: track.progressMs,
    durationMs: track.durationMs,
    updatedAt: Date.now(),
  };
  player.classList.add("is-playing");
  cover.src = track.cover;
  stateText.textContent = "Now playing";
  title.textContent = track.title;
  artist.textContent = track.artist;
  spotifyTrackUrl = track.url;
  updateSpotifyProgress();
  setSpotifyStatus(track.artist);
}

async function refreshSpotifyNowPlaying() {
  if (!SPOTIFY_NOW_PLAYING_ENDPOINT) {
    renderSpotifyTrack(null);
    return;
  }

  try {
    const response = await fetch(SPOTIFY_NOW_PLAYING_ENDPOINT, {
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);

    const data = await response.json();
    renderSpotifyTrack(normalizeSpotifyPayload(data));
  } catch (error) {
    renderSpotifyTrack(null);
    setSpotifyStatus("Not playing anything");
  }
}

function initSpotifyWidget() {
  positionSpotifyWindow();
  requestAnimationFrame(positionSpotifyWindow);
  refreshSpotifyNowPlaying();

  const refreshButton = document.getElementById("btn-refresh-spotify");
  if (refreshButton) {
    refreshButton.addEventListener("click", refreshSpotifyNowPlaying);
  }

  const openButton = document.getElementById("btn-open-spotify-link");
  if (openButton) {
    openButton.addEventListener("click", () => {
      window.open(spotifyTrackUrl, "_blank");
    });
  }

  window.addEventListener("resize", positionSpotifyWindow);

  if (spotifyRefreshTimer) clearInterval(spotifyRefreshTimer);
  spotifyRefreshTimer = setInterval(
    refreshSpotifyNowPlaying,
    SPOTIFY_REFRESH_INTERVAL,
  );

  if (spotifyProgressTimer) clearInterval(spotifyProgressTimer);
  spotifyProgressTimer = setInterval(updateSpotifyProgress, 1000);
}

function initWelcomeButtons() {
  const map = {
    "btn-open-about": "about-window",
    "btn-open-projects": "projects-window",
    "btn-open-spotify": "spotify-window",
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
  const spotifyWin = document.getElementById("spotify-window");

  gsap.fromTo(
    welcomeWin,
    { opacity: 0, scale: 0.7, y: 50 },
    {
      opacity: 1,
      scale: 1,
      y: 0,
      duration: 0.6,
      ease: "back.out(1.5)",
      delay: 0.1,
    },
  );

  if (spotifyWin) {
    positionSpotifyWindow();
    gsap.fromTo(
      spotifyWin,
      { opacity: 0, scale: 0.7, y: 50 },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.6,
        ease: "back.out(1.5)",
        delay: 0.2,
      },
    );
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initWindows();
  initWelcomeButtons();
  initSpotifyWidget();
  initWallpaperSettings();
  initLoadingScreen();
});
