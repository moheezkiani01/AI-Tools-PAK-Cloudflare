import { brand } from "../config";

// The PAK suffix is real, readable text so it cannot appear as an old cached PK logo.
// The brand symbol is versioned to avoid reusing the previous header logo from the browser cache.
export default function Logo() {
  return (
    <a href="/" aria-label={brand.name} className="flex min-w-0 shrink-0 items-center gap-1.5" title={brand.name}>
      <img
        src="/brand-symbol-pak.png"
        alt=""
        aria-hidden="true"
        width="39"
        height="29"
        className="h-7 w-auto shrink-0 sm:h-8"
        decoding="async"
      />
      <span className="whitespace-nowrap text-[18px] font-extrabold tracking-tight text-[color:var(--text)] sm:text-[22px]">AI Tools</span>
      <span className="-mt-2 shrink-0 rounded-[5px] bg-[#1f2a44] px-[5px] py-[2px] text-[10px] font-extrabold leading-none tracking-[0.02em] text-white dark:bg-white dark:text-[#1f2a44] sm:text-[11px]">PAK</span>
    </a>
  );
}
