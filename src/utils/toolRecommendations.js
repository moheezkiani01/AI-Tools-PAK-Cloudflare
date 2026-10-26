import { sortCatalogGroups } from './catalogGroups.js';
export const needs = [
  { label:'All tools', icon:'ai-tools', all:true, brands:[], categories:[] },
  { label:'Write, research & code', icon:'ai-tools', brands:['chatgpt','claude','gemini','perplexity','grok','cursor'], categories:['ai-tools','developer-tools'] },
  { label:'Make images, video & voice', icon:'creative-tools', brands:['canva','runway','leonardo-ai','capcut','elevenlabs','higgsfield','kling-ai'], categories:['creative-tools','ai-tools'] },
  { label:'Design & presentations', icon:'productivity', brands:['canva','figma','adobe','gamma','freepik','notion'], categories:['creative-tools','productivity'] },
  { label:'Build apps & automate', icon:'developer-tools', brands:['cursor','replit','lovable','n8n','microsoft'], categories:['developer-tools'] },
  { label:'Write & study better', icon:'education-research', brands:['grammarly','quillbot','notion','coursera','perplexity','gamma'], categories:['productivity','education-research'] },
  { label:'Marketing & SEO', icon:'marketing-tools', brands:['semrush','vidiq','helium-10','success-ai','canva'], categories:['marketing-tools'] },
  { label:'Stay private online', icon:'vpn-security', brands:['nordvpn','surfshark','proton'], categories:['vpn-security'] },
  { label:'Watch & relax', icon:'entertainment', brands:['youtube','netflix','amazon-prime','spotify'], categories:['entertainment'] },
];

export function recommendedForNeed(groups, need, limit = 4) {
  const sorted = sortCatalogGroups(groups.filter(g => g.category !== 'api-tools'));
  if (need.all) return sorted.slice(0,limit);
  const chosen = [], seen = new Set();
  for (const slug of need.brands) {
    const candidate = sorted.find(g => g.slug === slug);
    if (candidate && !seen.has(candidate.slug)) { seen.add(candidate.slug); chosen.push(candidate); }
    if (chosen.length === limit) return chosen;
  }
  for (const group of sorted) {
    if (need.categories.includes(group.category) && !seen.has(group.slug)) {
      seen.add(group.slug); chosen.push(group);
      if (chosen.length === limit) break;
    }
  }
  return chosen;
}

