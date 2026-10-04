// Runs before first paint: applies stored theme/accessibility prefs, avoiding a flash.
// Kept as its own file so the Content-Security-Policy needs no inline-script allowance.
(function () {
  var ATTR = { textSize: "data-text-size", contrast: "data-contrast", motion: "data-motion", font: "data-font", spacing: "data-spacing", underline: "data-underline" };
  var NEUTRAL = ["auto", "md", "normal", "default", "off"];
  var GROUND = { light: "#faf9f7", dark: "#100e0d" };
  try {
    var prefs = JSON.parse(localStorage.getItem("nsa:a11y")) || {};
    for (var key in ATTR) {
      var value = prefs[key];
      if (value && NEUTRAL.indexOf(value) === -1) document.documentElement.setAttribute(ATTR[key], value);
    }
    // Light is the default; only an explicit "auto" defers to the OS. Resolved here so
    // CSS never sees "auto" and there is no flash before a11y.js loads.
    var pref = prefs.theme || "light";
    var theme = pref === "auto" ? (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light") : pref;
    document.documentElement.setAttribute("data-theme", theme);
    var meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", GROUND[theme]);

    var lang = new URLSearchParams(location.search).get("lang") || localStorage.getItem("nsa:lang");
    if (lang) document.documentElement.lang = lang;
  } catch (e) { /* storage blocked — defaults apply */ }
})();
