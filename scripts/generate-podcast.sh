#!/bin/bash
# generate-podcast.sh — Two-voice podcast narration for daily episode
#
# Generates a NotebookLM-style conversation between two hosts:
#   ANDREW (warm, confident) — The Analyst. Delivers the facts, connects patterns.
#   ARIA (positive, energetic) — The Builder. Reacts, asks "what does this mean?", gets excited.
#
# Uses Edge TTS neural voices + ffmpeg for mixing.
#
# Usage:
#   ./scripts/generate-podcast.sh 2026-03-27

set -euo pipefail

DATE="${1:?Usage: generate-podcast.sh <date>}"
PROJECT_DIR="$(cd "$(dirname "$0")/.." && pwd)"
EPISODE_FILE="${PROJECT_DIR}/src/content/episodes/${DATE}.json"
AUDIO_DIR="${PROJECT_DIR}/public/audio/${DATE}"
WORK_DIR="/tmp/tidox-podcast-${DATE}"

if [ ! -f "$EPISODE_FILE" ]; then
  echo "Episode file not found: $EPISODE_FILE"
  exit 1
fi

mkdir -p "$AUDIO_DIR" "$WORK_DIR"

echo "Generating two-voice podcast for ${DATE}..."

# ── Step 1: Generate the conversation script from episode data ──
python3 - "$EPISODE_FILE" "$WORK_DIR" << 'PYEOF'
import json, os, sys

episode = json.load(open(sys.argv[1]))
work_dir = sys.argv[2]

headlines = episode['scenes']['headlines']
trending = episode['trending'][:3]
takeaway = episode['scenes']['takeaway']['text']
date_display = episode['scenes']['masthead']['subtitle']

# Two hosts: Andrew (A) = analyst, Aria (B) = builder
# The conversation should feel like two smart friends at a coffee shop.
# Short lines. Reactions. Building on each other.

lines = [
    # INTRO
    ("A", f"Good morning. Welcome to the Intelligence Brief, {date_display}."),
    ("B", "Alright, what are we looking at today?"),
    ("A", "Three stories. And the first one is a big deal."),
    ("B", "Hit me."),

    # HEADLINE 1
    ("A", f"{headlines[0]['text']}."),
    ("B", f"Wait. {headlines[0]['metric']}?"),
    ("A", "Yeah. A cascading dependency attack. Someone compromised a Trivy package, which LiteLLM depends on. 97 million monthly downloads exposed."),
    ("B", "So the most popular LLM proxy in the world... got supply-chained."),
    ("A", "Exactly. And here's what's interesting. Cisco released a defensive tool the same day. The response time is measured in hours now, not months."),
    ("B", "That's actually reassuring. The immune system is getting faster."),

    # HEADLINE 2
    ("A", f"Second story. {headlines[1]['text']}."),
    ("B", "A skill. Not a framework. Not a platform. Just one skill."),
    ("A", "One skill that does research. And it hit number one on GitHub trending. Over 2,600 stars in a single day."),
    ("B", "This validates something we've been watching. The single-purpose pattern. Do one thing, do it exceptionally well."),
    ("A", "The Claude Code ecosystem is now producing viral individual skills faster than the frameworks."),
    ("B", "Wild."),

    # HEADLINE 3
    ("A", f"And from Meta's research labs. {headlines[2]['text']}."),
    ("B", "Recursive self-improvement. That's... that's the thing everyone said was theoretical."),
    ("A", "Not anymore. These agents rewrite not just their task code, but how they improve themselves. And the unexpected part? Cross-domain transfer. Robotics strategies improving math grading."),
    ("B", "OK that's genuinely new. An agent that gets better at getting better."),

    # TRENDING
    ("A", f"On the trending board. {trending[0]['name']} leads at {trending[0]['delta']} per day."),
    ("B", f"Followed by {trending[1]['name']} from ByteDance at {trending[1]['delta']}."),
    ("A", f"And {trending[2]['name']} just crossed {trending[2]['stars']} stars."),
    ("B", "The plugin ecosystem growing faster than the underlying tool. That's platform status."),

    # TAKEAWAY
    ("A", "So here's the takeaway."),
    ("B", "What's the pattern?"),
    ("A", "The AI supply chain is now a target-rich environment. But the response is measured in hours. Meanwhile, the single-purpose skill pattern is validating at scale."),
    ("B", "Not frameworks. Not platforms. One tool. One thing. Done well."),
    ("A", "That's the whole game."),

    # CLOSE
    ("B", "Alright. That's your Intelligence Brief for today. Go build something."),
    ("A", "See you tomorrow."),
]

# Write the script as JSON for the TTS step
script_path = os.path.join(work_dir, "script.json")
with open(script_path, 'w') as f:
    json.dump(lines, f, indent=2)

print(f"  Script: {len(lines)} lines")
for speaker, text in lines:
    print(f"    [{speaker}] {text[:70]}...")
PYEOF

# ── Step 2: Generate TTS for each line ──────────────────────
echo ""
echo "  Generating TTS..."

python3 - "$WORK_DIR" << 'PYEOF'
import json, os, sys, subprocess

work_dir = sys.argv[1]
script = json.load(open(os.path.join(work_dir, "script.json")))

VOICES = {
    "A": "en-US-AndrewNeural",    # Analyst: warm, confident
    "B": "en-US-AriaNeural",      # Builder: positive, energetic
}
RATES = {
    "A": "+0%",
    "B": "+5%",   # Aria slightly faster = more energy
}

for i, (speaker, text) in enumerate(script):
    mp3 = os.path.join(work_dir, f"line-{i:03d}.mp3")
    wav = os.path.join(work_dir, f"line-{i:03d}.wav")

    subprocess.run([
        "edge-tts",
        "--voice", VOICES[speaker],
        "--rate", RATES[speaker],
        "--text", text,
        "--write-media", mp3
    ], check=True, capture_output=True)

    subprocess.run([
        "ffmpeg", "-y", "-i", mp3, "-ar", "44100", "-ac", "1", wav
    ], capture_output=True)
    os.remove(mp3)

    # Get duration
    result = subprocess.run(
        ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", wav],
        capture_output=True, text=True
    )
    dur = float(result.stdout.strip())
    print(f"    [{speaker}] {dur:.1f}s: {text[:50]}...")

print(f"\n  {len(script)} lines generated")
PYEOF

# ── Step 3: Concatenate with natural pauses ─────────────────
echo ""
echo "  Mixing conversation..."

python3 - "$WORK_DIR" "$AUDIO_DIR" << 'PYEOF'
import json, os, sys, subprocess

work_dir = sys.argv[1]
audio_dir = sys.argv[2]
script = json.load(open(os.path.join(work_dir, "script.json")))

# Build ffmpeg concat list with pauses between lines
concat_list = os.path.join(work_dir, "concat.txt")
silence_short = os.path.join(work_dir, "silence-short.wav")
silence_medium = os.path.join(work_dir, "silence-medium.wav")
silence_long = os.path.join(work_dir, "silence-long.wav")

# Generate silence files
subprocess.run(["sox", "-n", "-r", "44100", "-c", "1", silence_short, "trim", "0", "0.15"], capture_output=True)   # 150ms between lines (same speaker or quick reaction)
subprocess.run(["sox", "-n", "-r", "44100", "-c", "1", silence_medium, "trim", "0", "0.4"], capture_output=True)   # 400ms between speakers (natural turn-taking)
subprocess.run(["sox", "-n", "-r", "44100", "-c", "1", silence_long, "trim", "0", "1.0"], capture_output=True)     # 1s between sections (topic change)

with open(concat_list, 'w') as f:
    for i, (speaker, text) in enumerate(script):
        wav = os.path.join(work_dir, f"line-{i:03d}.wav")
        f.write(f"file '{wav}'\n")

        if i < len(script) - 1:
            next_speaker = script[i + 1][0]

            # Longer pause at section transitions (after "Hit me.", "Wild.", etc.)
            if text.strip().endswith(("Hit me.", "Wild.", "That's the whole game.")):
                f.write(f"file '{silence_long}'\n")
            elif speaker == next_speaker:
                f.write(f"file '{silence_short}'\n")
            else:
                f.write(f"file '{silence_medium}'\n")

# Concatenate all lines
conversation = os.path.join(work_dir, "conversation-raw.wav")
subprocess.run([
    "ffmpeg", "-y", "-f", "concat", "-safe", "0",
    "-i", concat_list, "-c", "copy", conversation
], capture_output=True)

# Get duration
result = subprocess.run(
    ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", conversation],
    capture_output=True, text=True
)
total_dur = float(result.stdout.strip())
print(f"  Conversation: {total_dur:.1f}s")

# Generate ambient bed matching conversation length + 4s buffer
ambient = os.path.join(work_dir, "ambient.wav")
pad_dur = int(total_dur) + 4
subprocess.run([
    "sox", "-n", ambient,
    "synth", str(pad_dur), "sine", "110", "sine", "165", "sine", "220",
    "tremolo", "0.5", "20",
    "fade", "t", "2", str(pad_dur), "3",
    "gain", "-28"
], capture_output=True)

# Final mix: conversation (loud) + ambient (quiet)
output = os.path.join(audio_dir, "podcast.wav")
subprocess.run([
    "ffmpeg", "-y",
    "-i", conversation,
    "-i", ambient,
    "-filter_complex",
    f"[0:a]volume=1.0[voice];[1:a]volume=0.08,atrim=0:{pad_dur}[amb];[voice][amb]amix=inputs=2:duration=first:normalize=0[mixed];[mixed]loudnorm=I=-16:TP=-1.5:LRA=11[out]",
    "-map", "[out]",
    "-ar", "44100", "-ac", "2",
    output
], capture_output=True)

result = subprocess.run(
    ["ffprobe", "-v", "quiet", "-show_entries", "format=duration", "-of", "csv=p=0", output],
    capture_output=True, text=True
)
final_dur = float(result.stdout.strip())
print(f"  Final podcast: {final_dur:.1f}s")
print(f"  Output: {output}")

PYEOF

# ── Cleanup ─────────────────────────────────────────────────
rm -rf "$WORK_DIR"

echo ""
echo "  ✓ Podcast generated"
ls -lh "$AUDIO_DIR/podcast.wav"
