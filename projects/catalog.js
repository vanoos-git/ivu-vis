(() => {
  "use strict";

  const status = document.getElementById("catalog-status");
  const list = document.getElementById("catalog-list");
  const template = document.getElementById("project-card");
  const projectsFolder = new URL("projects/", document.baseURI);

  function makeCard(project) {
    const { folder, title, subtitle } = project;
    if (typeof folder !== "string" || !folder.trim() || folder === "." || folder === ".." || /[\\/]/.test(folder)
      || typeof title !== "string" || !title.trim()) {
      throw new Error("Неверная запись проекта.");
    }

    const item = template.content.firstElementChild.cloneNode(true);
    item.querySelector(".project-link").href = new URL(encodeURIComponent(folder) + "/", projectsFolder);
    item.querySelector(".project-name").textContent = title;
    const description = item.querySelector(".project-subtitle");
    description.textContent = typeof subtitle === "string" ? subtitle : "";
    description.hidden = !description.textContent;
    return item;
  }

  async function loadCatalog() {
    if (projectsFolder.protocol === "file:") {
      status.textContent = "Откройте сайт через GitHub Pages или локальный HTTP-сервер, чтобы увидеть список проектов.";
      return;
    }

    const response = await fetch(new URL("catalog.json", projectsFolder), { cache: "no-cache" });
    if (!response.ok) throw new Error("Каталог недоступен.");
    const projects = await response.json();
    if (!Array.isArray(projects)) throw new Error("Неверный формат каталога.");
    if (projects.length === 0) {
      status.textContent = "Проектов пока нет.";
      return;
    }

    list.replaceChildren(...projects.map(makeCard));
    status.hidden = true;
  }

  loadCatalog().catch(() => {
    status.textContent = "Не удалось загрузить список проектов.";
  });
})();
