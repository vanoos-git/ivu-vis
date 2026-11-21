(() => {
  "use strict";

  const url = new URL(window.location.href);
  const project = url.searchParams.get("p");
  if (!project) return;

  window.__ivuProjectRoute = true;
  document.documentElement.style.visibility = "hidden";

  const siteRoot = new URL("./", url);
  const templateUrl = new URL("projects/project.html", siteRoot);
  templateUrl.searchParams.set("v", "13");
  const sharedFolder = new URL("projects/", siteRoot);

  fetch(templateUrl)
    .then((response) => {
      if (!response.ok) throw new Error("Не удалось загрузить шаблон проекта.");
      return response.text();
    })
    .then((markup) => {
      const page = new DOMParser().parseFromString(markup, "text/html");
      const base = page.createElement("base");
      base.href = sharedFolder.href;
      page.head.prepend(base);
      document.open();
      document.write("<!doctype html>\n" + page.documentElement.outerHTML);
      document.close();
    })
    .catch((error) => {
      document.documentElement.style.visibility = "";
      const status = document.getElementById("catalog-status");
      if (status) status.textContent = error.message || "Не удалось открыть проект.";
    });
})();