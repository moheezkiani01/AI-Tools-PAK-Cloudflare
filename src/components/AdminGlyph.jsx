// Small, dependency-free icons for the admin workspace.
const paths = {
  grid: <><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></>,
  receipt: <><path d="M5 3h14v18l-3-2-4 2-4-2-3 2z"/><path d="M9 8h6M9 12h6M9 16h4"/></>,
  chat: <path d="M20 11.5a8 8 0 0 1-8 8 9 9 0 0 1-4-.9L3 21l1.4-4.5A8 8 0 1 1 20 11.5Z"/>,
  star: <path d="m12 2 3.1 6.4 7.1 1-5.1 5 .9 7-6-3.4-6 3.4.9-7-5.1-5 7.1-1z"/>,
  box: <><path d="m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10"/></>,
  edit: <><path d="m15 4 5 5-12 12H3v-5zM13 6l5 5"/></>,
  price: <><path d="M12 2v20M17 6H9a3.5 3.5 0 1 0 0 7h6a3.5 3.5 0 0 1 0 7H6"/></>,
  tag: <><path d="M3 4v8l9 9 9-9-9-8z"/><circle cx="8" cy="9" r="1"/></>,
  key: <><circle cx="8" cy="14" r="4"/><path d="m11 11 10-10M17 5l3 3M14 8l3 3"/></>,
  lock: <><rect x="5" y="10" width="14" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></>,
  arrow: <path d="M5 12h14m-6-6 6 6-6 6"/>,
  external: <><path d="M13 5h6v6M19 5l-9 9"/><path d="M19 13v6H5V5h6"/></>,
  logout: <><path d="M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M14 7l5 5-5 5M19 12H9"/></>,
  refresh: <><path d="M20 6v5h-5M4 18v-5h5"/><path d="M5.5 9a7 7 0 0 1 12.8-2.3L20 11M4 13l1.7 4.3A7 7 0 0 0 18.5 15"/></>,
  search: <><circle cx="10.5" cy="10.5" r="7"/><path d="m16 16 5 5"/></>,
};
export default function AdminGlyph({ name, size = 18 }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">{paths[name] || paths.grid}</svg>;
}
