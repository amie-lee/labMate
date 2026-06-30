import { useEffect, useState } from "react";

export function useTheme() {
  const [dark, setDark] = useState(() => localStorage.getItem("lm_theme") === "dark");
  useEffect(() => {
    document.body.classList.toggle("dark", dark);
    localStorage.setItem("lm_theme", dark ? "dark" : "light");
  }, [dark]);
  return { dark, toggle: () => setDark((v) => !v) };
}
