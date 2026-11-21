export function initViewer(gallery, frames) {
  const viewer = document.querySelector(".viewer");
  const stage = viewer.querySelector(".viewer-stage");
  let fullImage = viewer.querySelector(".viewer-image");
  const announcement = viewer.querySelector(".viewer-announcement");
  let currentIndex = 0;
  let gesture = null;
  let request = 0;
  let fade;
  let previousLayer;
  const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");

  async function showImage(index) {
    currentIndex = (index + frames.length) % frames.length;
    const requestId = ++request;
    const frame = frames[currentIndex];
    const incoming = new Image();
    incoming.className = "viewer-image";
    incoming.alt = frame.alt;
    incoming.draggable = false;
    incoming.src = frame.src;
    try {
      await incoming.decode();
    } catch {
      // Let the viewer show the image fallback if the file cannot be decoded.
    }
    if (requestId !== request || !viewer.open) return;

    fade?.cancel();
    previousLayer?.remove();
    previousLayer = null;
    const outgoing = fullImage;
    outgoing.replaceWith(incoming);
    fullImage = incoming;
    announcement.textContent = "Кадр " + (currentIndex + 1) + " из " + frames.length + ". " + frame.alt;
    if (!reducedMotion.matches) {
      if (outgoing.naturalWidth) {
        const layer = document.createElement("div");
        layer.className = "viewer-image-layer";
        layer.setAttribute("aria-hidden", "true");
        layer.append(outgoing);
        stage.prepend(layer);
        previousLayer = layer;
        // Keep the old frame opaque until the incoming frame is nearly visible.
        layer.animate([{ opacity: 1 }, { opacity: 1, offset: .75 }, { opacity: 0 }], {
          duration: 400,
          easing: "ease",
          fill: "forwards"
        });
      }
      fade = fullImage.animate([{ opacity: 0 }, { opacity: 1 }], {
        duration: 400,
        easing: "ease"
      });
      const layer = previousLayer;
      fade.finished.then(() => layer?.remove(), () => layer?.remove());
    }
  }

  gallery.addEventListener("click", (event) => {
    const tile = event.target.closest("button.tile");
    if (!tile) return;
    const index = Number(tile.dataset.frameIndex);
    if (!frames[index]) return;
    viewer.showModal();
    showImage(index);
  });

  stage.addEventListener("pointerdown", (event) => {
    if (!event.isPrimary || event.button !== 0) return;
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
    if (width >= threshold && width > height * 1.2) {
      showImage(currentIndex + (deltaX < 0 ? 1 : -1));
    } else if (deltaY >= 60 && height > width * 1.2) {
      viewer.close();
    } else if (width < 10 && height < 10) {
      // The image is centered at its displayed size, leaving the margins to close the viewer.
      const bounds = fullImage.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right ||
          event.clientY < bounds.top || event.clientY > bounds.bottom) {
        viewer.close();
      } else if (event.clientX < bounds.left + bounds.width * .25) {
        showImage(currentIndex - 1);
      } else if (event.clientX > bounds.right - bounds.width * .25) {
        showImage(currentIndex + 1);
      }
    }
  });

  stage.addEventListener("pointercancel", () => { gesture = null; });
  stage.addEventListener("lostpointercapture", () => { gesture = null; });
  stage.addEventListener("dragstart", (event) => event.preventDefault());
  viewer.addEventListener("close", () => {
    if (viewer.open) return;
    request++;
    fade?.cancel();
    previousLayer?.remove();
    previousLayer = null;
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
