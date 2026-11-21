export function initViewer(gallery, frames) {
  const viewer = document.querySelector(".viewer");
  const stage = viewer.querySelector(".viewer-stage");
  let fullImage = viewer.querySelector(".viewer-image");
  const announcement = viewer.querySelector(".viewer-announcement");
  const counter = viewer.querySelector(".viewer-counter");
  const hint = viewer.querySelector(".viewer-hint");
  const closeButton = viewer.querySelector(".viewer-close");
  const compact = matchMedia("(max-width: 640px)");
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
  const transitionDuration = 250;
  const closeDuration = 300;
  let currentIndex = 0;
  let gesture = null;
  let pinch = null;
  let suppressNextTap = false;
  const activePointers = new Map();
  let zoom = 1;
  let panX = 0;
  let panY = 0;
  let request = 0;
  let fade;
  let previousLayer;
  let closeAnimation;

  function updateHint() {
    hint.textContent = compact.matches
      ? "Разведите пальцы, чтобы увеличить. Перемещайте фото одним пальцем; свайп в сторону листает."
      : "Нажмите на левую или правую половину экрана, чтобы листать. Для закрытия нажмите ×.";
  }

  function announceImage(index, frame) {
    counter.textContent = String(index + 1).padStart(2, "0") + " / " + String(frames.length).padStart(2, "0");
    announcement.textContent = "Кадр " + (index + 1) + " из " + frames.length + ". " + frame.alt;
  }

  function applyZoom() {
    if (zoom <= 1) {
      zoom = 1;
      panX = 0;
      panY = 0;
    }
    fullImage.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${zoom})`;
    fullImage.style.cursor = zoom > 1 ? "grab" : "";
  }

  function clampPan() {
    const maxX = Math.max(0, (fullImage.offsetWidth * zoom - stage.clientWidth) / 2);
    const maxY = Math.max(0, (fullImage.offsetHeight * zoom - stage.clientHeight) / 2);
    panX = Math.max(-maxX, Math.min(maxX, panX));
    panY = Math.max(-maxY, Math.min(maxY, panY));
  }

  function pointerCenter(points) {
    const [first, second] = points;
    return { x: (first.x + second.x) / 2, y: (first.y + second.y) / 2 };
  }

  function imageBaseCenter() {
    const bounds = fullImage.getBoundingClientRect();
    return {
      x: bounds.left + bounds.width / 2 - panX,
      y: bounds.top + bounds.height / 2 - panY
    };
  }

  function startPinch() {
    const points = [...activePointers.values()].slice(0, 2);
    if (points.length < 2) return;
    const center = pointerCenter(points);
    const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
    const imageCenter = imageBaseCenter();
    pinch = {
      distance: Math.max(distance, 1),
      zoom,
      center,
      imageX: (center.x - imageCenter.x - panX) / zoom,
      imageY: (center.y - imageCenter.y - panY) / zoom
    };
    suppressNextTap = true;
    gesture = null;
  }

  updateHint();
  compact.addEventListener("change", updateHint);

  async function showImage(index, openAfterLoad = false) {
    if (viewer.classList.contains("is-closing") || !frames.length) return;
    const targetIndex = (index + frames.length) % frames.length;
    const requestId = ++request;
    const frame = frames[targetIndex];
    const incoming = new Image();
    incoming.className = "viewer-image";
    incoming.alt = frame.alt;
    incoming.draggable = false;
    incoming.src = frame.src;
    try {
      await incoming.decode();
    } catch {
      if (!incoming.naturalWidth) {
        announcement.textContent = "Не удалось загрузить изображение «" + frame.alt + "».";
        return;
      }
    }
    if (requestId !== request || viewer.classList.contains("is-closing")) return;
    if (!viewer.open) {
      if (!openAfterLoad) return;
      viewer.showModal();
    }

    fade?.cancel();
    previousLayer?.remove();
    previousLayer = null;
    const outgoing = fullImage;
    outgoing.replaceWith(incoming);
    fullImage = incoming;
    zoom = 1;
    panX = 0;
    panY = 0;
    applyZoom();
    currentIndex = targetIndex;
    announceImage(currentIndex, frame);

    if (!reducedMotion.matches) {
      if (outgoing.naturalWidth) {
        const layer = document.createElement("div");
        layer.className = "viewer-image-layer";
        layer.setAttribute("aria-hidden", "true");
        layer.append(outgoing);
        stage.prepend(layer);
        previousLayer = layer;
        layer.animate([{ opacity: 1 }, { opacity: 1, offset: .35 }, { opacity: 0 }], {
          duration: transitionDuration,
          easing: "ease",
          fill: "forwards"
        });
      }
      fade = fullImage.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: transitionDuration,
        easing: "ease"
      });
      const layer = previousLayer;
      fade.finished.then(() => layer?.remove(), () => layer?.remove());
    }
  }

  function closeViewer() {
    if (!viewer.open || closeAnimation || viewer.classList.contains("is-closing")) return;
    gesture = null;
    if (reducedMotion.matches) {
      viewer.close();
      return;
    }

    viewer.classList.add("is-closing");
    closeAnimation = stage.animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: closeDuration,
      easing: "ease",
      fill: "forwards"
    });
    closeAnimation.finished.then(() => {
      if (viewer.open) viewer.close();
    }, () => {
      closeAnimation = null;
    });
  }

  gallery.addEventListener("click", (event) => {
    const tile = event.target.closest("button.tile");
    if (!tile) return;
    const index = Number(tile.dataset.frameIndex);
    if (!frames[index]) return;
    if (viewer.open) {
      showImage(index);
      return;
    }
    showImage(index, true);
  });

  function beginGesture(id, x, y) {
    activePointers.set(id, { x, y });
    if (activePointers.size >= 2) {
      startPinch();
    } else {
      if (zoom > 1) fullImage.style.cursor = "grabbing";
      gesture = { id, x, y, lastX: x, lastY: y };
    }
  }

  function moveGesture(id, x, y) {
    const point = activePointers.get(id);
    if (!point) return;
    point.x = x;
    point.y = y;
    if (pinch && activePointers.size >= 2) {
      const points = [...activePointers.values()].slice(0, 2);
      const center = pointerCenter(points);
      const distance = Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y);
      const imageCenter = imageBaseCenter();
      zoom = Math.max(1, Math.min(4, pinch.zoom * distance / pinch.distance));
      panX = center.x - imageCenter.x - pinch.imageX * zoom;
      panY = center.y - imageCenter.y - pinch.imageY * zoom;
      clampPan();
      applyZoom();
      return;
    }

    if (gesture?.id === id && zoom > 1) {
      panX += x - gesture.lastX;
      panY += y - gesture.lastY;
      gesture.lastX = x;
      gesture.lastY = y;
      clampPan();
      applyZoom();
    }
  }

  function endGesture(id, x, y) {
    const point = activePointers.get(id);
    if (!point) return;
    point.x = x;
    point.y = y;
    activePointers.delete(id);
    if (pinch) {
      pinch = null;
      gesture = null;
      if (activePointers.size === 1) {
        const [id, point] = [...activePointers.entries()][0];
        gesture = { id, x: point.x, y: point.y, lastX: point.x, lastY: point.y };
      }
      return;
    }
    if (gesture?.id !== id) return;
    const deltaX = x - gesture.x;
    const deltaY = y - gesture.y;
    gesture = null;
    if (zoom > 1) {
      fullImage.style.cursor = "grab";
      suppressNextTap = false;
      return;
    }
    if (suppressNextTap) {
      suppressNextTap = false;
      return;
    }

    const width = Math.abs(deltaX);
    const height = Math.abs(deltaY);
    const threshold = Math.min(56, stage.clientWidth * .14);
    if (compact.matches && width >= threshold && width > height * 1.2) {
      showImage(currentIndex + (deltaX < 0 ? 1 : -1));
    } else if (deltaY >= 60 && height > width * 1.2) {
      closeViewer();
    } else if (width < 10 && height < 10) {
      const bounds = viewer.getBoundingClientRect();
      showImage(x < bounds.left + bounds.width / 2 ? currentIndex - 1 : currentIndex + 1);
    }
  }

  function cancelGesture(id) {
    activePointers.delete(id);
    gesture = null;
    pinch = null;
    if (!activePointers.size) suppressNextTap = false;
  }

  stage.addEventListener("pointerdown", (event) => {
    if (event.pointerType === "touch" || event.button !== 0 || viewer.classList.contains("is-closing")) return;
    beginGesture(event.pointerId, event.clientX, event.clientY);
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener("pointermove", (event) => {
    if (event.pointerType !== "touch") moveGesture(event.pointerId, event.clientX, event.clientY);
  });
  stage.addEventListener("pointerup", (event) => {
    if (event.pointerType !== "touch") endGesture(event.pointerId, event.clientX, event.clientY);
  });
  stage.addEventListener("pointercancel", (event) => {
    if (event.pointerType !== "touch") cancelGesture(event.pointerId);
  });
  stage.addEventListener("lostpointercapture", (event) => {
    if (event.pointerType === "touch") return;
    activePointers.delete(event.pointerId);
    if (!activePointers.size) {
      gesture = null;
      pinch = null;
      suppressNextTap = false;
    }
  });

  stage.addEventListener("touchstart", (event) => {
    if (viewer.classList.contains("is-closing")) return;
    event.preventDefault();
    for (const touch of event.changedTouches) {
      beginGesture("touch-" + touch.identifier, touch.clientX, touch.clientY);
    }
  }, { passive: false });
  stage.addEventListener("touchmove", (event) => {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      moveGesture("touch-" + touch.identifier, touch.clientX, touch.clientY);
    }
  }, { passive: false });
  stage.addEventListener("touchend", (event) => {
    event.preventDefault();
    for (const touch of event.changedTouches) {
      endGesture("touch-" + touch.identifier, touch.clientX, touch.clientY);
    }
  }, { passive: false });
  stage.addEventListener("touchcancel", (event) => {
    activePointers.clear();
    gesture = null;
    pinch = null;
    suppressNextTap = false;
  }, { passive: false });
  stage.addEventListener("dragstart", (event) => event.preventDefault());
  viewer.addEventListener("click", (event) => {
    if (event.target === viewer) closeViewer();
  });
  closeButton.addEventListener("click", closeViewer);

  viewer.addEventListener("cancel", (event) => {
    event.preventDefault();
    closeViewer();
  });
  viewer.addEventListener("close", () => {
    request++;
    fade?.cancel();
    closeAnimation?.cancel();
    closeAnimation = null;
    previousLayer?.remove();
    previousLayer = null;
    viewer.classList.remove("is-closing");
    gesture = null;
    pinch = null;
    suppressNextTap = false;
    activePointers.clear();
    zoom = 1;
    panX = 0;
    panY = 0;
    fullImage.removeAttribute("src");
    fullImage.style.transform = "";
    fullImage.style.cursor = "";
    fullImage.alt = "";
  });

  viewer.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showImage(currentIndex + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });
}
