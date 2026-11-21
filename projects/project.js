(() => {
  "use strict";

  const mosaic = document.getElementById("project-mosaic");
  const status = document.getElementById("project-status");
  const title = document.getElementById("project-title");
  const subtitle = document.getElementById("project-subtitle");
  const heading = title.closest(".project-heading");
  const compact = matchMedia("(max-width: 540px)");
  const page = new URL(document.baseURI);
  const projectsFolder = new URL("./", document.currentScript.src);
  const folder = document.querySelector(".project").dataset.project ?? page.searchParams.get("project");
  const validFolder = folder && folder.trim() && folder !== "." && folder !== ".." && !/[\\/]/.test(folder);
  const projectFolder = new URL(validFolder ? encodeURIComponent(folder) + "/" : "./", projectsFolder);
  const imagesFolder = new URL("images/", projectFolder);

  heading.setAttribute("data-awaiting-title", "");
  mosaic.hidden = true;
  mosaic.setAttribute("aria-busy", "true");
  status.dataset.loading = "";
  status.hidden = false;

  function showStatus(message) {
    heading.removeAttribute("data-awaiting-title");
    mosaic.removeAttribute("aria-busy");
    status.removeAttribute("data-loading");
    status.textContent = message;
    status.hidden = message === "";
  }

  async function revealHeading() {
    heading.classList.add("project-heading-enter");
    showStatus("");
    await Promise.allSettled(
      heading.getAnimations({ subtree: true }).map((animation) => animation.finished)
    );
  }

  async function readProject() {
    const response = await fetch(new URL("project.json", projectFolder));
    if (!response.ok) {
      throw new Error("Не удалось открыть project.json (HTTP " + response.status + ").");
    }

    let project;
    try {
      project = await response.json();
    } catch {
      throw new Error("Проверьте синтаксис файла project.json.");
    }
    if (typeof project?.title !== "string" || !project.title.trim()) {
      throw new Error("Укажите заголовок в поле title файла project.json.");
    }
    return project;
  }

  function readGroups(project) {
    if (project.groups === undefined && Array.isArray(project.images)) {
      return [{ title: "", images: project.images.map(readImageEntry) }];
    }
    if (!Array.isArray(project.groups)) throw new Error("Перечислите блоки в поле groups файла project.json.");
    return project.groups.map((group) => {
      if (typeof group?.title !== "string" || !group.title.trim() || !Array.isArray(group.images)) {
        throw new Error("Укажите название и список кадров для каждого блока.");
      }
      return { title: group.title.trim(), images: group.images.map(readImageEntry) };
    });
  }

  function readImageEntry(entry, index) {
    const settings = typeof entry === "string" ? { file: entry } : entry;
    const file = settings?.file;
    if (typeof file !== "string" || !file.trim() || file === "." || file === ".." || /[\\/]/.test(file)) {
      throw new Error("Для кадра " + (index + 1) + " укажите имя файла из папки images.");
    }
    const src = new URL(encodeURIComponent(file), imagesFolder).href;
    const alt = typeof settings.alt === "string" ? settings.alt : file;
    return { ...settings, file, src, alt };
  }

  async function loadTile(settings) {
    const image = new Image();
    image.alt = settings.alt;
    image.decoding = "async";
    if (typeof settings.position === "string") image.style.objectPosition = settings.position;
    image.src = settings.src;
    await image.decode();

    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.dataset.frameIndex = String(settings.index);
    tile.setAttribute("aria-label", "Открыть кадр «" + (image.alt || settings.file) + "»");
    tile.append(image);
    const ratio = Math.min(3.3, Math.max(.53, image.naturalWidth / image.naturalHeight));
    return { tile, ratio };
  }

  function split(direction, children) {
    const rowWeights = direction === "row";
    const sum = children.reduce((total, child) => total + (rowWeights ? child.ratio : 1 / child.ratio), 0);
    return { direction, children, ratio: rowWeights ? sum : 1 / sum };
  }

  const row = (...children) => split("row", children);
  const stack = (...children) => split("column", children);

  function chooseLayout(tiles, isCompact) {
    const [a, b, c, d] = tiles;
    if (!b) return a;
    if (!c && !isCompact) return row(a, b);

    const candidates = !c
      ? [[row(a, b), 0], [stack(a, b), .12]]
      : !d
        ? [[row(a, stack(b, c)), .03], [stack(a, row(b, c)), 0], [row(stack(a, b), c), .14], [row(a, b, c), .27]]
        : [
            [row(a, stack(b, row(c, d))), 0],
            [row(a, stack(row(b, c), d)), .1],
            [row(stack(a, b), stack(c, d)), .17],
            [row(stack(a, b), c, d), .2]
          ];
    const target = isCompact ? (c ? 1.08 : 1.46) : 2.45;
    const score = ([layout, penalty]) => Math.abs(Math.log(layout.ratio / target)) + penalty;
    return candidates.reduce((best, candidate) => score(candidate) < score(best) ? candidate : best)[0];
  }

  function buildNode(layout) {
    if (layout.tile) return layout.tile;
    const container = document.createElement("div");
    container.className = "project-split";
    container.style.setProperty("--direction", layout.direction);
    for (const child of layout.children) {
      const element = buildNode(child);
      const weight = layout.direction === "row" ? child.ratio / layout.ratio : layout.ratio / child.ratio;
      element.style.setProperty("--weight", weight);
      container.append(element);
    }
    return container;
  }

  function renderMosaic(container, tiles) {
    const fragment = document.createDocumentFragment();
    const focusedTile = container.contains(document.activeElement) ? document.activeElement : null;
    const blockSize = compact.matches ? 3 : 4;
    for (let start = 0; start < tiles.length;) {
      const remaining = tiles.length - start;
      const count = remaining === blockSize + 1 ? blockSize - 1 : Math.min(blockSize, remaining);
      const layout = chooseLayout(tiles.slice(start, start + count), compact.matches);
      const block = document.createElement("div");
      block.className = "project-block";
      block.style.setProperty("--block-ratio", layout.ratio);
      if (layout.tile) block.style.setProperty("--single-width", Math.round(layout.ratio * 650) + "px");
      block.append(buildNode(layout));
      fragment.append(block);
      start += count;
    }
    container.replaceChildren(fragment);
    focusedTile?.focus({ preventScroll: true });
  }

  function createGroup(group, index) {
    const section = document.createElement("section");
    section.className = "project-group";
    if (group.title) {
      const heading = document.createElement("h2");
      heading.className = "project-group-title";
      heading.id = "project-group-title-" + index;
      heading.textContent = group.title;
      section.setAttribute("aria-labelledby", heading.id);
      section.append(heading);
    }
    const notice = document.createElement("p");
    notice.className = "project-status";
    notice.setAttribute("role", "status");
    notice.hidden = true;
    const container = document.createElement("div");
    container.className = "project-mosaic";
    section.append(notice, container);
    return { ...group, section, notice, container, tiles: [] };
  }

  async function loadGroup(group) {
    const pictures = await Promise.allSettled(group.images.map(loadTile));
    const missing = [];
    for (const [index, picture] of pictures.entries()) {
      if (picture.status === "fulfilled") group.tiles.push(picture.value);
      else missing.push(group.images[index].file);
    }
    renderMosaic(group.container, group.tiles);
    group.notice.textContent = missing.length
      ? "Не удалось загрузить изображения — " + missing.join(", ") + "."
      : group.tiles.length ? "" : "В этом блоке пока нет кадров.";
    group.notice.hidden = !group.notice.textContent;
  }

  async function openProject() {
    if (page.protocol === "file:") {
      showStatus("Откройте подстраницу через GitHub Pages или локальный HTTP-сервер, чтобы загрузить project.json.");
      return;
    }

    if (!validFolder) {
      showStatus("Выберите проект на главной странице.");
      return;
    }
    const project = await readProject();
    document.title = project.title.trim();
    title.textContent = document.title;
    subtitle.textContent = typeof project.subtitle === "string" ? project.subtitle.trim() : "";
    subtitle.hidden = !subtitle.textContent;

    const groups = readGroups(project).map(createGroup);
    if (!groups.length) {
      await revealHeading();
      showStatus("В проекте пока нет кадров.");
      return;
    }

    mosaic.classList.add("project-groups");
    mosaic.replaceChildren(...groups.map((group) => group.section));
    const frames = groups.flatMap((group) => group.images);
    frames.forEach((frame, index) => { frame.index = index; });
    const [{ initViewer }] = await Promise.all([
      import(new URL("../gallery.js?v=3", projectsFolder).href),
      ...groups.map(loadGroup)
    ]);
    initViewer(mosaic, frames);
    compact.addEventListener("change", () => {
      for (const group of groups) renderMosaic(group.container, group.tiles);
    });
    await revealHeading();
    if (matchMedia("(prefers-reduced-motion: no-preference)").matches) {
      await new Promise((resolve) => setTimeout(resolve, 500));
    }
    mosaic.classList.add("project-mosaic-enter");
    mosaic.hidden = false;
  }

  openProject().catch((error) => showStatus(error.message || "Не удалось открыть подстраницу."));
})();
