import Script from "next/script";

const THEME_INIT = `
(function () {
  try {
    var stored = localStorage.getItem("kiyaari-theme");
    var dark =
      stored === "dark" ||
      (stored !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    var theme = dark ? "dark" : "light";
    var root = document.documentElement;
    root.setAttribute("data-theme", theme);
    root.classList.toggle("dark", dark);
  } catch (e) {}
})();
`;

/** Applies saved theme before hydration to avoid flash. */
export function ThemeInitScript() {
  return (
    <Script id="kiyaari-theme-init" strategy="beforeInteractive">
      {THEME_INIT}
    </Script>
  );
}
