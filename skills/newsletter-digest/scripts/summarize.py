#!/usr/bin/env python3
"""Extract key points from content - title, date, and bullet list of important sentences"""

import sys
import re
import json
import argparse
from datetime import datetime
from typing import Optional


def extract_title(text: str) -> Optional[str]:
    """Extract title from first heading or first line"""
    lines = text.split("\n")
    for line in lines:
        line = line.strip()
        if line.startswith("#"):
            return re.sub(r"^#+\s*", "", line).strip()
        if line and len(line) > 10 and len(line) < 200:
            return line
    return None


def extract_date(text: str) -> Optional[str]:
    """Extract date from text using common patterns"""
    patterns = [
        r"(\d{4}-\d{2}-\d{2})",
        r"(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{1,2},?\s+\d{4}",
        r"(\d{1,2}\s+(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{4})",
    ]

    for pattern in patterns:
        match = re.search(pattern, text, re.IGNORECASE)
        if match:
            return match.group(1)

    return None


def extract_key_sentences(text: str, max_points: int = 5) -> list[str]:
    """Extract key sentences from text"""
    sentences = re.split(r"(?<=[.!?])\s+", text)
    sentences = [s.strip() for s in sentences if s.strip()]

    if not sentences:
        return []

    scored_sentences = []
    for i, sentence in enumerate(sentences):
        score = 0

        if len(sentence) > 20 and len(sentence) < 300:
            score += 1

        if any(
            word in sentence.lower()
            for word in [
                "important",
                "key",
                "critical",
                "must",
                "should",
                "new",
                "announce",
            ]
        ):
            score += 2

        if sentence[0].isupper():
            score += 1

        if i < len(sentences) // 3:
            score += 1

        scored_sentences.append((score, sentence))

    scored_sentences.sort(key=lambda x: x[0], reverse=True)
    key_points = [s[1] for s in scored_sentences[:max_points]]

    return sorted(key_points, key=lambda x: sentences.index(x) if x in sentences else 0)


def main():
    parser = argparse.ArgumentParser(description="Extract key points from content")
    parser.add_argument(
        "--max-points", type=int, default=5, help="Maximum number of key points"
    )
    parser.add_argument("--json", action="store_true", help="Output as JSON")
    args = parser.parse_args()

    content = sys.stdin.read().strip()

    if not content:
        print("Error: No input provided", file=sys.stderr)
        sys.exit(1)

    title = extract_title(content)
    date = extract_date(content)
    key_points = extract_key_sentences(content, args.max_points)

    if args.json:
        result = {
            "title": title,
            "date": date,
            "key_points": key_points,
            "extracted_at": datetime.now().isoformat(),
        }
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        if title:
            print(f"# {title}\n")
        if date:
            print(f"**Date:** {date}\n")

        if key_points:
            print("## Key Points\n")
            for point in key_points:
                print(f"- {point}")
        else:
            print("_No key points extracted_")


if __name__ == "__main__":
    main()
