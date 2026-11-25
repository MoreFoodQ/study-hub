export interface FeedItem {
  id: string;
  title: string;
  url: string;
  meta: string;
  summary?: string;
  copyUrl?: string;
}

export type FeedChannel = 'hf_papers' | 'biostat_papers' | 'hn_ml' | 'github_repos';

export async function fetchFeed(channel: FeedChannel, topic = 'biostatistics'): Promise<FeedItem[]> {
  if (channel === 'hf_papers') {
    const res = await fetch('https://huggingface.co/api/daily_papers?limit=10');
    if (!res.ok) throw new Error(`HF API ${res.status}`);
    const data = (await res.json()) as Array<{
      title?: string;
      summary?: string;
      publishedAt?: string;
      paper?: { id?: string; title?: string; summary?: string; upvotes?: number };
    }>;
    return data.slice(0, 8).map((item, idx) => {
      const pid = item.paper?.id || '';
      const arxivUrl = pid ? `https://arxiv.org/abs/${pid}` : 'https://huggingface.co/papers';
      const hfUrl = pid ? `https://huggingface.co/papers/${pid}` : 'https://huggingface.co/papers';
      const votes = item.paper?.upvotes ?? 0;
      const date = (item.publishedAt || '').slice(0, 10);
      return {
        id: pid || String(idx),
        title: item.paper?.title || item.title || 'Untitled paper',
        url: hfUrl,
        copyUrl: arxivUrl,
        meta: `▲ ${votes} upvotes${date ? ` · ${date}` : ''}`,
        summary: (item.paper?.summary || item.summary || '').slice(0, 200),
      };
    });
  }

  if (channel === 'biostat_papers') {
    const q = encodeURIComponent(topic);
    const res = await fetch(`https://api.openalex.org/works?search=${q}&sort=publication_date:desc&per-page=8`);
    if (!res.ok) throw new Error(`OpenAlex ${res.status}`);
    const data = (await res.json()) as {
      results?: Array<{
        id?: string;
        doi?: string;
        title?: string;
        publication_date?: string;
        cited_by_count?: number;
        primary_location?: { source?: { display_name?: string } };
      }>;
    };
    return (data.results || []).map((w, idx) => {
      const link = w.doi || w.id || 'https://openalex.org/';
      const venue = w.primary_location?.source?.display_name || 'Journal / Preprint';
      return {
        id: w.id || String(idx),
        title: w.title || 'Untitled study',
        url: link,
        copyUrl: link,
        meta: `${w.publication_date || ''} · ${venue}`,
      };
    });
  }

  if (channel === 'hn_ml') {
    const res = await fetch('https://hn.algolia.com/api/v1/search_by_date?query=machine+learning+OR+LLM+OR+statistics&tags=story&hitsPerPage=8');
    if (!res.ok) throw new Error(`HN ${res.status}`);
    const data = (await res.json()) as {
      hits?: Array<{ objectID: string; title?: string; url?: string; points?: number; num_comments?: number; created_at?: string }>;
    };
    return (data.hits || []).map((h) => ({
      id: h.objectID,
      title: h.title || 'Discussion',
      url: h.url || `https://news.ycombinator.com/item?id=${h.objectID}`,
      meta: `▲ ${h.points ?? 0} · ${h.num_comments ?? 0} comments · ${(h.created_at || '').slice(0, 10)}`,
    }));
  }

  // github_repos
  const res = await fetch('https://api.github.com/users/MoreFoodQ/repos?sort=updated&per_page=8');
  if (!res.ok) throw new Error(`GitHub ${res.status}`);
  const repos = (await res.json()) as Array<{
    id: number;
    name: string;
    html_url: string;
    homepage?: string;
    description?: string;
    language?: string;
    updated_at?: string;
  }>;
  return repos.map((r) => ({
    id: String(r.id),
    title: r.name,
    url: r.homepage || r.html_url,
    meta: `${r.language || 'Project'} · updated ${(r.updated_at || '').slice(0, 10)}`,
    summary: r.description || undefined,
  }));
}
