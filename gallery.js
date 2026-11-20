(() => {
  "use strict";

  const gallery = document.getElementById("project-mosaic") ?? document.querySelector(".mosaic");
  const viewer = document.querySelector(".viewer");
  const fullImage = viewer.querySelector(".viewer-image");
  const announcement = viewer.querySelector(".viewer-announcement");
  const previousArrow = viewer.querySelector(".viewer-previous");
  const nextArrow = viewer.querySelector(".viewer-next");
  let tiles = [];
  let currentIndex = 0;

  function showImage(index) {
    currentIndex = (index + tiles.length) % tiles.length;
    const thumbnail = tiles[currentIndex].querySelector("img");
    fullImage.src = thumbnail.src;
    fullImage.alt = thumbnail.alt;
    announcement.textContent = "Кадр " + (currentIndex + 1) + " из " + tiles.length + ". " + thumbnail.alt;
  }

  gallery.addEventListener("click", (event) => {
    const tile = event.target.closest("button.tile");
    if (!tile) return;
    const group = tile.closest(".project-group") ?? gallery;
    tiles = Array.from(group.querySelectorAll("button.tile"));
    previousArrow.hidden = nextArrow.hidden = tiles.length < 2;
    viewer.showModal();
    showImage(tiles.indexOf(tile));
  });

  const previous = () => showImage(currentIndex - 1);
  const next = () => showImage(currentIndex + 1);

  previousArrow.addEventListener("click", previous);
  nextArrow.addEventListener("click", next);
  viewer.querySelector(".viewer-close").addEventListener("click", () => viewer.close());

  viewer.addEventListener("keydown", (event) => {
    if (event.key === "ArrowLeft") {
      event.preventDefault();
      previous();
    } else if (event.key === "ArrowRight") {
      event.preventDefault();
      next();
    }
  });
})();
