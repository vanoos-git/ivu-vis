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
  let request = 0;
  let fade;
  let previousLayer;
  let closeAnimation;

  function updateHint() {
    hint.textContent = compact.matches
      ? "Проведите в сторону, чтобы листать. Для закрытия нажмите × или проведите вниз."
      : "Нажмите на левую или правую половину экрана, чтобы листать. Для закрытия нажмите ×.";
  }

  function announceImage(index, frame) {
    counter.textContent = String(index + 1).padStart(2, "0") + " / " + String(frames.length).padStart(2, "0");
    announcement.textContent = "Кадр " + (index + 1) + " из " + frames.length + ". " + frame.alt;
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

  stage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0 || viewer.classList.contains("is-closing")) return;
    gesture = { id: event.pointerId, x: event.clientX, y: event.clientY };
    stage.setPointerCapture(event.pointerId);
  });

  stage.addEventListener("pointerup", (event) => {
    if (gesture?.id !== event.pointerId) return;
    const deltaX = event.clientX - gesture.x;
    const deltaY = event.clientY - gesture.y;
    gesture = null;

    const width = Math.abs(deltaX);
    const height = Math.abs(deltaY);
    const threshold = Math.min(56, stage.clientWidth * .14);
    if (compact.matches && width >= threshold && width > height * 1.2) {
      showImage(currentIndex + (deltaX < 0 ? 1 : -1));
    } else if (deltaY >= 60 && height > width * 1.2) {
      closeViewer();
    } else if (width < 10 && height < 10) {
      const bounds = viewer.getBoundingClientRect();
      showImage(event.clientX < bounds.left + bounds.width / 2 ? currentIndex - 1 : currentIndex + 1);
    }
  });

  stage.addEventListener("pointercancel", () => { gesture = null; });
  stage.addEventListener("lostpointercapture", () => { gesture = null; });
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
    fullImage.removeAttribute("src");
    fullImage.alt = "";
  });

  viewer.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showImage(currentIndex + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });
}
