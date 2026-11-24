(function () {
  try {
    var theme = localStorage.getItem("cm_office_theme");
    if (
      theme === "dark" ||
      (!theme &&
        window.matchMedia &&
        window.matchMedia("(prefers-color-scheme: dark)").matches)
    ) {
      document.documentElement.setAttribute("data-theme", "dark");
    } else {
      document.documentElement.setAttribute("data-theme", "light");
    }
    var savedPalette = localStorage.getItem("cm_office_palette");
    var palette =
      savedPalette === "emerald" ||
      savedPalette === "minimal" ||
      savedPalette === "aurora"
        ? savedPalette
        : "emerald";
    document.documentElement.setAttribute("data-palette", palette);
  } catch (e) {}
})();
