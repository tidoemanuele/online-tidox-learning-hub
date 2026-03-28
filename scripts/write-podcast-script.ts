#!/usr/bin/env npx tsx
/**
 * write-podcast-script.ts — Generates a two-voice podcast script with reasoning.
 *
 * Uses Claude Code (headless) to write the script from episode data.
 * The AI writes the conversation, not us hardcoding it.
 *
 * Usage:
 *   npx tsx scripts/write-podcast-script.ts 2026-03-27
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

const DATE = process.argv[2] || new Date().toISOString().split('T')[0];
const PROJECT_DIR = join(import.meta.dirname!, '..');
const EPISODE_FILE = join(PROJECT_DIR, 'src', 'content', 'episodes', `${DATE}.json`);
const OUT_DIR = join(PROJECT_DIR, 'public', 'audio', DATE);
const SCRIPT_FILE = join(OUT_DIR, 'script.json');

if (!existsSync(EPISODE_FILE)) {
  console.error(`Episode not found: ${EPISODE_FILE}`);
  process.exit(1);
}

mkdirSync(OUT_DIR, { recursive: true });

const episode = JSON.parse(readFileSync(EPISODE_FILE, 'utf-8'));

const prompt = `You are writing a two-voice podcast script for a daily tech intelligence brief.

TWO HOSTS:
- ANDREW (A): The Analyst. Calm, precise, connects patterns across domains. Delivers facts but always follows with "here's why this matters" or "here's what this tells us." Thinks in systems.
- ARIA (B): The Builder. Energetic, curious, asks the hard follow-up questions. Says "wait, but what does that mean for..." and "OK so if that's true, then..." Thinks in opportunities. Gets genuinely excited when she sees an implication the data doesn't spell out.

VOICE AND TONE:
- This is NOT a news broadcast. It's two smart people reasoning out loud.
- Every fact must be followed by analysis: what does it MEAN? What does it IMPLY?
- Connect stories to each other. "Notice how this connects to what we just said about..."
- Disagree sometimes. "I'm not sure that's the right read. I think what's actually happening is..."
- Think about the listener: a developer or builder. What should they DO differently because of this?
- End each topic with a concrete insight or action, not just "interesting."
- The overall arc should build toward a thesis: what is TODAY telling us about where things are going?
- Inspire. The closing should make the listener feel "I need to go build something."

FORMAT:
Return a JSON array of [speaker, text] tuples. Speaker is "A" or "B".
Keep individual lines SHORT (1-3 sentences max). Real conversation has short turns.
Include natural reactions: "Exactly.", "Wait.", "That's wild.", "Hmm, I don't know about that."
Include thinking pauses: "Let me think about this...", "So what you're saying is..."
Total: 25-35 lines. Target ~3 minutes when spoken.

EPISODE DATA FOR ${DATE}:
${JSON.stringify({
  headlines: episode.scenes.headlines,
  insights: episode.insights.slice(0, 6),
  trending: episode.trending.slice(0, 5),
  takeaway: episode.scenes.takeaway,
  heroStat: episode.heroStat,
}, null, 2)}

Write the script. Return ONLY the JSON array, no markdown, no explanation.`;

console.log(`Writing podcast script for ${DATE}...`);
console.log(`  Using Claude to generate reasoning-driven conversation...`);

const promptFile = '/tmp/tidox-podcast-prompt.txt';
writeFileSync(promptFile, prompt);

try {
  const result = execFileSync(
    'claude',
    ['-p', readFileSync(promptFile, 'utf-8'), '--max-turns', '3'],
    { encoding: 'utf-8', timeout: 120000, maxBuffer: 1024 * 1024 }
  );

  let scriptJson = result.trim();
  const jsonMatch = scriptJson.match(/\[[\s\S]*\]/);
  if (jsonMatch) {
    scriptJson = jsonMatch[0];
  }

  const script = JSON.parse(scriptJson);

  if (!Array.isArray(script) || script.length === 0) {
    throw new Error('Script is not a valid array');
  }

  writeFileSync(SCRIPT_FILE, JSON.stringify(script, null, 2));
  console.log(`\n  Script: ${script.length} lines`);
  console.log(`  Output: ${SCRIPT_FILE}`);

  for (const [speaker, text] of script.slice(0, 6)) {
    console.log(`    [${speaker}] ${(text as string).slice(0, 75)}...`);
  }
  if (script.length > 6) console.log(`    ... (${script.length - 6} more lines)`);

} catch (err: any) {
  console.error(`  Failed: ${err.message}`);
  process.exit(1);
}
