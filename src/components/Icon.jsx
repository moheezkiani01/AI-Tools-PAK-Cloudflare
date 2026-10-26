// Simple line icons. Category slugs double as icon names.
const paths = {
  discounts: "M3 11V4h7l11 11-7 7L3 11zM7.5 8h.01",
  "ai-tools": "M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9zM19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8z",
  "creative-tools": "M12 22a1 1 0 0 1 0-20 10 9 0 0 1 10 9 5 5 0 0 1-5 5h-2.25a1.75 1.75 0 0 0-1.4 2.8l.3.4a1.75 1.75 0 0 1-1.4 2.8z",
  "developer-tools": "m16 18 6-6-6-6M8 6l-6 6 6 6",
  productivity: "M3 3v18h18M7 15l4-4 3 3 5-6",
  "vpn-security": "M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z",
  entertainment: "M5 4l14 8-14 8z",
  professional: "M3 8h18v12H3zM9 8V5h6v3",
  "education-research": "M3 5q4-2 9 1 5-3 9-1v15q-4-2-9 1-5-3-9-1zM12 6v15",
  "api-tools": "M8 4H4v16h4M16 4h4v16h-4M10 14l4-4",
  "marketing-tools": "M3 10v4h3l6 4V6L6 10H3zM16 9a4 4 0 010 6M18.5 6.5a8 8 0 010 11",
  bolt: "M13 2L4 14h7l-1 8 9-12h-7z",
  truck: "M3 6h11v11H3zM14 10h4l3 3v4h-7M5.5 19a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0zM16 19a1.5 1.5 0 1 0 3 0 1.5 1.5 0 0 0-3 0z",
  "shopping-bag": "M4 8h16l-1 13H5L4 8zM9 9V6a3 3 0 0 1 6 0v3",
  download: "M12 3v12m-5-5 5 5 5-5M5 17v4h14v-4",
  price: "M12 2v20M17 6H9.5a3 3 0 000 6h5a3 3 0 010 6H6",
  lock: "M6 11h12v9H6zM8 11V8a4 4 0 018 0v3",
  chat: "M4 5h16v11H9l-5 4z",
  users: "M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2M9 11a4 4 0 100-8 4 4 0 000 8zM22 21v-2a4 4 0 00-3-3.9M16 3.1a4 4 0 010 7.8",
  box: "M3 7l9-4 9 4v10l-9 4-9-4zM3 7l9 4 9-4M12 11v10",
  sun: "M12 17a5 5 0 100-10 5 5 0 000 10zM12 1v2M12 21v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M1 12h2M21 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4",
  moon: "M21 12.8A9 9 0 1111.2 3a7 7 0 009.8 9.8z",
  star: "M12 3l2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1L3.2 9.5l6.1-.9z",
};

export default function Icon({ name, size = 22, fill = "none" }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={paths[name]} />
    </svg>
  );
}

export function Stars({ value, size = 16 }) {
  return (
    <span className="inline-flex text-amber-400" aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((i) => <Icon key={i} name="star" size={size} fill={i <= Math.round(value) ? "currentColor" : "none"} />)}
    </span>
  );
}
