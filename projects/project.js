(() => {
  "use strict";

  const mosaic = document.getElementById("project-mosaic");
  const status = document.getElementById("project-status");
  const title = document.getElementById("project-title");
  const subtitle = document.getElementById("project-subtitle");
  const heading = title.closest(".project-heading");
  const compact = matchMedia("(max-width: 640px)");
  const page = new URL(window.location.href);
  const projectsFolder = new URL("./", document.currentScript.src);
  const projectFolder = new URL("./", page);
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

  function revealHeading(message = "") {
    heading.classList.add("project-heading-enter");
    showStatus(message);
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
      return [{ title: "", images: project.images.map((entry, index) => readImageEntry(entry, index, "Визуализация")) }];
    }
    if (!Array.isArray(project.groups)) throw new Error("Перечислите блоки в поле groups файла project.json.");
    return project.groups.map((group, groupIndex) => {
      if (typeof group?.title !== "string" || !group.title.trim() || !Array.isArray(group.images)) {
        throw new Error("Укажите название и список кадров для каждого блока.");
      }
      return {
        title: group.title.trim(),
        caption: typeof group.caption === "string" ? group.caption.trim() : "",
        index: groupIndex,
        desktopRow: group.desktopRow === true,
        images: group.images.map((entry, index) => readImageEntry(entry, index, group.title.trim()))
      };
    });
  }

  function readImageEntry(entry, index, groupTitle) {
    const settings = typeof entry === "string" ? { file: entry } : entry;
    const file = settings?.file;
    if (typeof file !== "string" || !file.trim() || file === "." || file === ".." || /[\\/]/.test(file)) {
      throw new Error("Для кадра " + (index + 1) + " укажите имя файла из папки images.");
    }
    const src = new URL(encodeURIComponent(file), imagesFolder).href;
    const alt = typeof settings.alt === "string" && settings.alt.trim()
      ? settings.alt.trim()
      : (groupTitle ? groupTitle + ", ракурс " : "Ракурс ") + (index + 1);
    return { ...settings, file, src, alt };
  }

  function createTile(settings, isCover = false) {
    const image = document.createElement("img");
    image.alt = settings.alt;
    image.decoding = "async";
    image.loading = "eager";
    if (isCover) image.fetchPriority = "high";
    if (Number.isFinite(settings.width) && settings.width > 0 &&
        Number.isFinite(settings.height) && settings.height > 0) {
      image.width = settings.width;
      image.height = settings.height;
    }
    if (typeof settings.position === "string") image.style.objectPosition = settings.position;
    image.src = settings.src;

    const tile = document.createElement("button");
    tile.type = "button";
    tile.className = "tile";
    tile.dataset.frameIndex = String(settings.index);
    tile.setAttribute("aria-label", "Открыть кадр «" + (image.alt || settings.file) + "»");
    tile.append(image);
    image.addEventListener("error", () => tile.classList.add("tile-error"), { once: true });
    const sourceRatio = settings.width > 0 && settings.height > 0 ? settings.width / settings.height : 1.5;
    const ratio = Math.min(3.3, Math.max(.53, sourceRatio));
    if (isCover) {
      tile.classList.add("project-cover");
      tile.style.aspectRatio = sourceRatio;
    }
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

  function renderMosaic(container, tiles, desktopRow) {
    const fragment = document.createDocumentFragment();
    const focusedTile = container.contains(document.activeElement) ? document.activeElement : null;
    const blockSize = compact.matches ? 3 : 4;
    for (let start = 0; start < tiles.length;) {
      const remaining = tiles.length - start;
      const count = remaining === blockSize + 1 ? blockSize - 1 : Math.min(blockSize, remaining);
      const blockTiles = tiles.slice(start, start + count);
      const layout = desktopRow && !compact.matches && blockTiles.length > 1
        ? row(...blockTiles)
        : chooseLayout(blockTiles, compact.matches);
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
    section.style.setProperty("--group-index", index);
    if (group.title) {
      const heading = document.createElement("h2");
      heading.className = "project-group-title";
      heading.id = "project-group-title-" + index;
      heading.textContent = group.title;
      section.setAttribute("aria-labelledby", heading.id);
      section.append(heading);
    }
    if (group.caption) {
      const caption = document.createElement("p");
      caption.className = "project-group-caption";
      caption.textContent = group.caption;
      section.append(caption);
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

  function setMeta(selector, attribute, value) {
    let element = document.head.querySelector(selector);
    if (!element) {
      element = document.createElement("meta");
      const match = selector.match(/\[(name|property)="([^"]+)"\]/);
      if (match) element.setAttribute(match[1], match[2]);
      document.head.append(element);
    }
    element.setAttribute(attribute, value);
  }

  function updateMetadata(project, frames) {
    const description = typeof project.description === "string" && project.description.trim()
      ? project.description.trim()
      : project.title.trim();
    const canonical = projectFolder.href;
    document.title = project.title.trim();
    setMeta('meta[name="description"]', "content", description);
    setMeta('meta[property="og:type"]', "content", "website");
    setMeta('meta[property="og:title"]', "content", document.title);
    setMeta('meta[property="og:description"]', "content", description);
    setMeta('meta[property="og:url"]', "content", canonical);
    const firstFrame = frames[0];
    if (firstFrame) setMeta('meta[property="og:image"]', "content", firstFrame.src);
    const canonicalLink = document.head.querySelector('link[rel="canonical"]');
    if (canonicalLink) canonicalLink.href = canonical;
  }

  function updateNavigation(project) {
    const nav = document.getElementById("project-navigation");
    const projectRoot = new URL("../", projectFolder);
    const navigation = project.navigation && typeof project.navigation === "object" ? project.navigation : {};
    let visible = false;
    for (const [id, key, prefix] of [
      ["project-previous", "previous", "Предыдущий проект"],
      ["project-next", "next", "Следующий проект"]
    ]) {
      const link = document.getElementById(id);
      const destination = navigation[key];
      if (!destination || typeof destination.folder !== "string" ||
          !destination.folder.trim() || destination.folder === "." || destination.folder === ".." || /[\\/]/.test(destination.folder)) {
        link.hidden = true;
        continue;
      }
      const name = typeof destination.title === "string" && destination.title.trim()
        ? destination.title.trim()
        : destination.folder;
      link.href = new URL(encodeURIComponent(destination.folder) + "/", projectRoot).href;
      link.textContent = prefix + ": " + name;
      link.hidden = false;
      link.classList.toggle("project-next", key === "next");
      visible = true;
    }
    nav.hidden = !visible;
  }

  function updateContacts(project) {
    const footer = document.getElementById("project-footer");
    const contacts = project.contacts && typeof project.contacts === "object" ? project.contacts : {};
    const studio = document.getElementById("project-studio");
    const email = document.getElementById("project-email");
    const links = document.getElementById("project-contact-links");
    let visible = Boolean(footer.querySelector(".project-credit"));

    if (typeof contacts.studio === "string" && contacts.studio.trim()) {
      studio.textContent = contacts.studio.trim();
      studio.hidden = false;
      visible = true;
    }
    if (typeof contacts.email === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contacts.email)) {
      email.href = "mailto:" + contacts.email;
      email.textContent = contacts.email;
      email.hidden = false;
      visible = true;
    }
    if (Array.isArray(contacts.links)) {
      for (const entry of contacts.links) {
        if (typeof entry?.label !== "string" || !entry.label.trim() || typeof entry.url !== "string") continue;
        let url;
        try { url = new URL(entry.url, projectFolder); } catch { continue; }
        if (!new Set(["https:", "http:"]).has(url.protocol)) continue;
        const anchor = document.createElement("a");
        anchor.href = url.href;
        anchor.textContent = entry.label.trim();
        anchor.rel = "noopener noreferrer";
        anchor.target = "_blank";
        links.append(anchor);
        visible = true;
      }
    }
    footer.hidden = !visible;
  }

  async function openProject() {
    if (page.protocol === "file:") {
      showStatus("Откройте подстраницу через GitHub Pages или локальный HTTP-сервер, чтобы загрузить project.json.");
      return;
    }

    const project = await readProject();
    title.textContent = project.title.trim();
    subtitle.textContent = typeof project.subtitle === "string" ? project.subtitle.trim() : "";
    subtitle.hidden = !subtitle.textContent;

    const groups = readGroups(project).map(createGroup);
    const cover = project.cover ? readImageEntry(project.cover, 0, "Обложка") : null;
    const frames = groups.flatMap((group) => group.images);
    if (cover) frames.unshift(cover);
    frames.forEach((frame, index) => { frame.index = index; });
    if (cover) {
      const hero = document.getElementById("project-hero");
      hero.classList.add("project-hero-with-cover");
      hero.append(createTile(cover, true).tile);
    }
    const summary = document.getElementById("project-summary");
    if (summary && typeof project.summary === "string" && project.summary.trim()) {
      summary.textContent = project.summary.trim();
      summary.hidden = false;
    }
    updateMetadata(project, frames);
    if (!frames.length) {
      updateNavigation(project);
      updateContacts(project);
      revealHeading("В проекте пока нет кадров.");
      return;
    }

    mosaic.classList.add("project-groups");
    mosaic.replaceChildren(...groups.map((group) => group.section));
    for (const group of groups) {
      group.tiles = group.images.map((frame) => createTile(frame));
      renderMosaic(group.container, group.tiles, group.desktopRow);
      group.notice.textContent = group.tiles.length ? "" : "В этом блоке пока нет кадров.";
      group.notice.hidden = !group.notice.textContent;
    }
    const images = mosaic.closest(".project").querySelectorAll(".tile img");
    const [{ initViewer }] = await Promise.all([
      import(new URL("../gallery.js?v=10", projectsFolder).href),
      Promise.allSettled(Array.from(images, (image) => image.decode()))
    ]);
    initViewer(mosaic.closest(".project"), frames);
    compact.addEventListener("change", () => {
      for (const group of groups) renderMosaic(group.container, group.tiles, group.desktopRow);
    });
    updateNavigation(project);
    updateContacts(project);
    mosaic.hidden = false;
    revealHeading();
  }

  openProject().catch((error) => showStatus(error.message || "Не удалось открыть подстраницу."));
})();
