import { useEffect, useMemo, useState } from 'react';
import { brandIcons } from '../data/brandIcons';
import { logoFiles } from '../data/logoFiles';
import { brandDomains } from '../data/brandDomains';
import { brandIconSlug, extractDomainFromText, inferBrandKey } from '../utils/brandFor';

const unique = (items) => [...new Set(items.filter(Boolean))];

export default function BrandIcon({ name, brandName, category, size = 44 }) {
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { setAttempt(0); }, [name, brandName, category]);

  const inferredKey = inferBrandKey(brandName, name, category);
  const exactKey = brandIconSlug(brandName || name) || name;
  const candidateKeys = unique([name, exactKey, inferredKey]);
  const localKey = candidateKeys.find((key) => logoFiles[key]);
  const builtinKey = candidateKeys.find((key) => brandIcons[key]);
  const builtin = builtinKey ? brandIcons[builtinKey] : null;
  const textDomain = extractDomainFromText(brandName, name);
  const keyDomain = candidateKeys
    .map((key) => brandDomains[key] || Object.entries(brandDomains)
      .filter(([slug]) => slug.length > 3 && key?.startsWith(`${slug}-`))
      .sort((a, b) => b[0].length - a[0].length)[0]?.[1])
    .find(Boolean);
  const domain = keyDomain || textDomain || null;
  const iconSources = unique([
    localKey ? `/logos/${localKey}.${logoFiles[localKey]}` : null,
    builtinKey ? `/brand-icons/${builtinKey}.svg` : null,
    domain ? `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=128` : null,
    domain ? `https://icons.duckduckgo.com/ip3/${encodeURIComponent(domain)}.ico` : null
  ]);
  const inner = iconSources[attempt] || null;
  const label = brandName || builtin?.title || inferredKey || name || 'AI tool';
  const initials = label.replace(/[^\u0000-\u007F]+/g, ' ').replace(/[^a-zA-Z0-9 ]/g, ' ').trim().split(/\s+/).slice(0, 2).map((word) => word[0]?.toUpperCase() || '').join('') || 'AI';
  const box = { width: size, height: size, borderRadius: size * 0.25 };
  const fallbackTone = useMemo(() => {
    const tones = {
      'ai-tools': 'from-blue-50 to-indigo-100 text-blue-700',
      'creative-tools': 'from-amber-50 to-orange-100 text-orange-700',
      'productivity': 'from-violet-50 to-purple-100 text-violet-700',
      'developer-tools': 'from-emerald-50 to-teal-100 text-emerald-700',
      'marketing-seo': 'from-rose-50 to-pink-100 text-rose-700',
      'education-tools': 'from-cyan-50 to-sky-100 text-sky-700',
      'security': 'from-green-50 to-lime-100 text-green-700',
      'entertainment': 'from-red-50 to-orange-100 text-red-700',
      'api-tools': 'from-slate-100 to-slate-200 text-slate-700',
      'social-tools': 'from-fuchsia-50 to-pink-100 text-fuchsia-700'
    };
    return tones[category] || 'from-slate-100 to-slate-200 text-slate-700';
  }, [category]);

  return (
    <span className="inline-grid shrink-0 place-items-center overflow-hidden bg-white text-slate-700 ring-1 ring-slate-900/10" style={box} title={label}>
      {inner ? (
        <img
          src={inner}
          alt=""
          loading="lazy"
          decoding="async"
          className="h-full w-full object-contain p-1.5"
          onError={() => setAttempt((current) => current + 1)}
          referrerPolicy="no-referrer"
        />
      ) : (
        <span className={`grid h-full w-full place-items-center bg-gradient-to-br ${fallbackTone}`} aria-hidden="true">
          <span className="select-none text-center font-extrabold tracking-tight" style={{ fontSize: Math.max(11, Math.round(size * 0.34)) }}>{initials}</span>
        </span>
      )}
    </span>
  );
}
