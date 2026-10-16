export const THEME_KEY = "bollard-ui-theme"

/** Runs before first paint (inlined in <head>) so the page never flashes the wrong theme. */
export const themeScript = `(function(){try{var t=localStorage.getItem("${THEME_KEY}");var d=t==="dark"||(t!=="light"&&matchMedia("(prefers-color-scheme: dark)").matches);document.documentElement.classList.toggle("dark",d);document.documentElement.style.colorScheme=d?"dark":"light"}catch(e){}})()`
