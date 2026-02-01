#!/usr/bin/env python3
"""HTML to markdown with sanitization - removes scripts, iframes, forms"""

import sys
import re
from html.parser import HTMLParser
from html import unescape


class HTMLSanitizer(HTMLParser):
    """Parse HTML and extract clean text, removing dangerous elements"""

    def __init__(self):
        super().__init__()
        self.text_parts = []
        self.skip_content = False
        self.skip_tags = {"script", "style", "iframe", "form", "noscript"}
        self.block_tags = {
            "p",
            "div",
            "h1",
            "h2",
            "h3",
            "h4",
            "h5",
            "h6",
            "li",
            "blockquote",
        }

    def handle_starttag(self, tag, attrs):
        """Handle opening tags"""
        tag_lower = tag.lower()

        if tag_lower in self.skip_tags:
            self.skip_content = True
        elif tag_lower == "br":
            self.text_parts.append("\n")
        elif tag_lower in self.block_tags:
            if self.text_parts and self.text_parts[-1] != "\n":
                self.text_parts.append("\n")

    def handle_endtag(self, tag):
        """Handle closing tags"""
        tag_lower = tag.lower()

        if tag_lower in self.skip_tags:
            self.skip_content = False
        elif tag_lower in self.block_tags:
            if self.text_parts and self.text_parts[-1] != "\n":
                self.text_parts.append("\n")

    def handle_data(self, data):
        """Handle text content"""
        if not self.skip_content:
            # Clean up whitespace
            text = data.strip()
            if text:
                self.text_parts.append(text)
                self.text_parts.append(" ")

    def get_text(self):
        """Get cleaned text"""
        text = "".join(self.text_parts)
        # Clean up multiple spaces and newlines
        text = re.sub(r" +", " ", text)
        text = re.sub(r"\n\s*\n+", "\n", text)
        return text.strip()


def sanitize_html(html_content):
    """Sanitize HTML and return clean text"""
    try:
        parser = HTMLSanitizer()
        parser.feed(html_content)
        return parser.get_text()
    except Exception as e:
        # Fallback: basic regex-based cleaning
        text = re.sub(
            r"<script[^>]*>.*?</script>",
            "",
            html_content,
            flags=re.DOTALL | re.IGNORECASE,
        )
        text = re.sub(
            r"<style[^>]*>.*?</style>", "", text, flags=re.DOTALL | re.IGNORECASE
        )
        text = re.sub(
            r"<iframe[^>]*>.*?</iframe>", "", text, flags=re.DOTALL | re.IGNORECASE
        )
        text = re.sub(
            r"<form[^>]*>.*?</form>", "", text, flags=re.DOTALL | re.IGNORECASE
        )
        text = re.sub(r"<[^>]+>", "", text)
        text = unescape(text)
        text = re.sub(r" +", " ", text)
        return text.strip()


def main():
    """Read HTML from stdin and output sanitized text"""
    html_input = sys.stdin.read()
    clean_text = sanitize_html(html_input)
    print(clean_text)


if __name__ == "__main__":
    main()
