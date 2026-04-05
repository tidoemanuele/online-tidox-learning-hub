import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const insightSchema = z.object({
  text: z.string(),
  tags: z.array(z.string().max(20)).max(3),
  source: z.string().optional(),
  /** Canonical link when the scraper has it (HN item, Lobsters story URL, etc.). */
  url: z.string().optional(),
});

const headlineSchema = z.object({
  text: z.string(),
  metric: z.string(),
  source: z.string(),
});

const episodes = defineCollection({
  loader: glob({ pattern: '**/*.json', base: './src/content/episodes' }),
  schema: z.object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    episodeNumber: z.number().int().positive(),
    locale: z.string().default('en-US'),
    title: z.string(),
    subtitle: z.string(),
    heroStat: z.object({
      value: z.string(),
      label: z.string(),
    }).optional(),
    insights: z.array(insightSchema).min(1),
    trending: z.array(z.object({
      name: z.string(),
      fullName: z.string().optional(),
      stars: z.string(),
      language: z.string(),
      delta: z.string(),
    })),
    numbers: z.array(z.object({
      label: z.string(),
      value: z.string(),
      unit: z.string(),
    })),
    scenes: z.object({
      masthead: z.object({ title: z.string(), subtitle: z.string() }),
      headlines: z.array(headlineSchema).max(3),
      takeaway: z.object({ text: z.string() }),
    }),
    audio: z.object({
      podcastUrl: z.string().optional(),
      briefAudioUrl: z.string().optional(),
      segmentDurations: z.array(z.number()).optional(),
    }).optional(),
  }),
});

export const collections = { episodes };
