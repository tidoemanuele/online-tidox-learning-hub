import type { APIRoute } from 'astro';
import { getCollection } from 'astro:content';
import { buildSearchIndex, type IndexableEpisode } from '../lib/search-index';

/** Prerendered to /search-index.json at build time; the site stays fully static. */
export const prerender = true;

export const GET: APIRoute = async () => {
  const episodes = await getCollection('episodes');
  const docs = buildSearchIndex(episodes.map((ep) => ep.data as IndexableEpisode));

  return new Response(JSON.stringify(docs), {
    headers: { 'Content-Type': 'application/json' },
  });
};
