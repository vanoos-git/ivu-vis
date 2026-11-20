(() => {
  "use strict";

  const tiles = Array.from(document.querySelectorAll(".tile"));
  const viewer = document.querySelector(".viewer");
  const fullImage = viewer.querySelector(".viewer-image");
  const announcement = viewer.querySelector(".viewer-announcement");
  let currentIndex = 0;

  function showImage(index) {
    currentIndex = (index + tiles.length) % tiles.length;
    const thumbnail = tiles[currentIndex].querySelector("img");
    fullImage.src = thumbnail.src;
    fullImage.alt = thumbnail.alt;
    announcement.textContent = "Кадр " + (currentIndex + 1) + " из " + tiles.length + ". " + thumbnail.alt;
  }

  for (const [index, tile] of tiles.entries()) {
    tile.addEventListener("click", () => {
      viewer.showModal();
      showImage(index);
    });
  }

  const previous = () => showImage(currentIndex - 1);
  const next = () => showImage(currentIndex + 1);

  viewer.querySelector(".viewer-previous").addEventListener("click", previous);
  viewer.querySelector(".viewer-next").addEventListener("click", next);
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
