import { useEffect } from "react";
import { brand } from "../config";

// Sets the browser tab title while a page is open (the SEO build sets it for search engines)
export function usePageTitle(title) {
  useEffect(() => {
    const old = document.title;
    document.title = `${title} | ${brand.name}`;
    return () => { document.title = old; };
  }, [title]);
}
