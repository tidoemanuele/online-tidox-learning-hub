/**
 * EpisodeProps — the core data contract for the Tidox Learning Hub.
 *
 * Flows from scraping pipeline → AI analysis → this schema → Remotion video + Astro site.
 * This is the single source of truth. Both the video package and the Astro site import from here.
 */

export interface EpisodeProps {
  // Metadata
  date: string;
  episodeNumber: number;
  locale: string;

  // Editorial content (produced by AI analysis step)
  title: string;
  subtitle: string;
  heroStat?: { value: string; label: string };
  insights: Insight[];

  // Structured data (from scrapers)
  trending: TrendingRepo[];
  numbers: Stat[];

  // Scene configuration for Remotion video
  scenes: {
    masthead: { title: string; subtitle: string };
    headlines: Headline[];
    takeaway: { text: string };
  };

  // Audio (populated after TTS step, empty in Phase 1-3)
  audio?: {
    podcastUrl?: string;
    segmentDurations?: number[];
  };
}

export interface Insight {
  text: string;
  tags: string[];    // max 3 tags, max 20 chars each
  source?: string;
}

export interface Headline {
  text: string;
  metric: string;
  source: string;
}

export interface TrendingRepo {
  name: string;
  stars: string;
  language: string;
  delta: string;
}

export interface Stat {
  label: string;
  value: string;
  unit: string;
}
