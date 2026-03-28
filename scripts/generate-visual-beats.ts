#!/usr/bin/env npx tsx
/**
 * generate-visual-beats.ts — Extract visual cues from podcast script.
 *
 * Reads script.json and produces beats.json with visual metadata per line.
 * Each beat specifies what to show on screen during that dialogue line.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { execFileSync } from 'child_process';

const DATE = process.argv[2] || new Date().toISOString().split('T')[0];
const PROJECT_DIR = join(import.meta.dirname!, '..');
const SCRIPT_FILE = join(PROJECT_DIR, 'public', 'audio', DATE, 'script.json');
const BEATS_FILE = join(PROJECT_DIR, 'public', 'audio', DATE, 'beats.json');

if (!existsSync(SCRIPT_FILE)) {
  console.error(`Script not found: ${SCRIPT_FILE}`);
  process.exit(1);
}

const script: [string, string][] = JSON.parse(readFileSync(SCRIPT_FILE, 'utf-8'));

console.log(`Generating visual beats for ${DATE} (${script.length} lines)...`);

// Use Claude to generate visual cues for each line
const prompt = `You are generating visual beat metadata for a podcast video. Each line of dialogue needs a visual.

BEAT TYPES:
- "intro": Dark navy background, serif title text. For opening/closing lines.
- "number": Big animated number center screen. When a specific number is mentioned.
- "quote": Italic text, key phrase highlighted. When someone makes a notable statement.
- "repo": Monospace repo name in a card. When a specific GitHub repo is discussed.
- "insight": Bold text with accent bar. When an analytical point is made.
- "action": Text with terracotta left bar. When a concrete action item is given.
- "close": Dark navy, serif, sign-off. For the last lines.

For each line, output a JSON object with:
- type: one of the beat types above
- highlight: the key phrase to show large (5-12 words max, extracted or summarized from the text)
- number: (only for "number" type) the specific number to animate large
- subtext: (optional) a short supporting line below the highlight
- label: (optional) small uppercase label above the highlight

RULES:
- Never repeat the same highlight twice
- Vary the beat types. Don't use "insight" for everything.
- When someone mentions a number, USE the "number" type
- When a repo name comes up, USE the "repo" type
- The first 2 lines should be "intro" type
- The last 2 lines should be "close" type
- "action" type for lines that tell the listener what to DO

SCRIPT:
${JSON.stringify(script, null, 2)}

Return a JSON array of visual objects, one per line. Same length as the script (${script.length} items). Return ONLY the JSON array.`;

const promptFile = '/tmp/tidox-beats-prompt.txt';
writeFileSync(promptFile, prompt);

try {
  const result = execFileSync(
    'claude',
    ['-p', readFileSync(promptFile, 'utf-8'), '--max-turns', '3'],
    { encoding: 'utf-8', timeout: 120000, maxBuffer: 1024 * 1024 }
  );

  let json = result.trim();
  const match = json.match(/\[[\s\S]*\]/);
  if (match) json = match[0];

  const beats = JSON.parse(json);

  if (beats.length !== script.length) {
    console.warn(`  Warning: ${beats.length} beats for ${script.length} lines. Adjusting...`);
    while (beats.length < script.length) beats.push({ type: 'insight', highlight: '...' });
    beats.length = script.length;
  }

  writeFileSync(BEATS_FILE, JSON.stringify(beats, null, 2));
  console.log(`  ✓ ${beats.length} visual beats written to ${BEATS_FILE}`);

  for (let i = 0; i < Math.min(8, beats.length); i++) {
    const b = beats[i];
    console.log(`    [${b.type}] ${(b.highlight || b.number || '').slice(0, 50)}`);
  }
  if (beats.length > 8) console.log(`    ... (${beats.length - 8} more)`);

} catch (err: any) {
  console.error(`  Failed: ${err.message}`);
  process.exit(1);
}
