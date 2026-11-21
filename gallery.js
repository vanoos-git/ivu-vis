export function initViewer(gallery, frames) {
  const viewer = document.querySelector(".viewer");
  const stage = viewer.querySelector(".viewer-stage");
  const fullImage = viewer.querySelector(".viewer-image");
  const announcement = viewer.querySelector(".viewer-announcement");
  let currentIndex = 0;
  let gesture = null;

  function showImage(index) {
    currentIndex = (index + frames.length) % frames.length;
    const frame = frames[currentIndex];
    fullImage.src = frame.src;
    fullImage.alt = frame.alt;
    announcement.textContent = "Кадр " + (currentIndex + 1) + " из " + frames.length + ". " + frame.alt;
  }

  gallery.addEventListener("click", (event) => {
    const tile = event.target.closest("button.tile");
    if (!tile) return;
    const index = Number(tile.dataset.frameIndex);
    if (!frames[index]) return;
    showImage(index);
    viewer.showModal();
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
    gesture = null;
    fullImage.removeAttribute("src");
  });

  viewer.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft" || event.key === "ArrowRight") {
      event.preventDefault();
      showImage(currentIndex + (event.key === "ArrowLeft" ? -1 : 1));
    }
  });
}
