#!/usr/bin/env bun
import { validateUrl } from "./validate-url";

type FeedItem = {
  title: string;
  link: string;
  pubDate: string;
  description: string;
};

type XmlNode = {
  name: string;
  attributes: Record<string, string>;
  children: XmlNode[];
  text: string;
};

const decodeXml = (value: string): string =>
  value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");

const parseAttributes = (source: string): Record<string, string> => {
  const attributes: Record<string, string> = {};
  const regex = /([\w:-]+)\s*=\s*"([^"]*)"|([\w:-]+)\s*=\s*'([^']*)'/g;
  let match: RegExpExecArray | null;
  while ((match = regex.exec(source)) !== null) {
    const name = match[1] ?? match[3];
    const value = match[2] ?? match[4] ?? "";
    if (name) attributes[name] = value;
  }
  return attributes;
};

const parseXml = (xml: string): XmlNode => {
  const root: XmlNode = { name: "root", attributes: {}, children: [], text: "" };
  const stack: XmlNode[] = [root];
  let index = 0;

  while (index < xml.length) {
    if (xml[index] !== "<") {
      const next = xml.indexOf("<", index);
      const end = next === -1 ? xml.length : next;
      const text = xml.slice(index, end);
      if (text.trim()) {
        stack[stack.length - 1].text += decodeXml(text);
      }
      index = end;
      continue;
    }

    if (xml.startsWith("<!--", index)) {
      const end = xml.indexOf("-->", index + 4);
      index = end === -1 ? xml.length : end + 3;
      continue;
    }

    if (xml.startsWith("<![CDATA[", index)) {
      const end = xml.indexOf("]]>", index + 9);
      const text = end === -1 ? xml.slice(index + 9) : xml.slice(index + 9, end);
      stack[stack.length - 1].text += text;
      index = end === -1 ? xml.length : end + 3;
      continue;
    }

    if (xml.startsWith("<?", index)) {
      const end = xml.indexOf("?>", index + 2);
      index = end === -1 ? xml.length : end + 2;
      continue;
    }

    if (xml.startsWith("</", index)) {
      const end = xml.indexOf(">", index + 2);
      if (end === -1) break;
      stack.pop();
      index = end + 1;
      continue;
    }

    if (xml.startsWith("<!", index)) {
      const end = xml.indexOf(">", index + 2);
      index = end === -1 ? xml.length : end + 1;
      continue;
    }

    const end = xml.indexOf(">", index + 1);
    if (end === -1) break;
    let tagSource = xml.slice(index + 1, end).trim();
    const selfClosing = tagSource.endsWith("/");
    if (selfClosing) {
      tagSource = tagSource.slice(0, -1).trim();
    }

    const spaceIndex = tagSource.search(/\s/);
    const tagName = spaceIndex === -1 ? tagSource : tagSource.slice(0, spaceIndex);
    const attrSource = spaceIndex === -1 ? "" : tagSource.slice(spaceIndex).trim();
    if (tagName) {
      const node: XmlNode = {
        name: tagName,
        attributes: parseAttributes(attrSource),
        children: [],
        text: "",
      };
      stack[stack.length - 1].children.push(node);
      if (!selfClosing) {
        stack.push(node);
      }
    }

    index = end + 1;
  }

  return root;
};

const collectText = (node: XmlNode | undefined): string => {
  if (!node) return "";
  const childText = node.children.map((child) => collectText(child)).join("");
  return (node.text + childText).trim();
};

const findAll = (node: XmlNode, name: string): XmlNode[] => {
  const matches: XmlNode[] = [];
  for (const child of node.children) {
    if (child.name === name) matches.push(child);
    matches.push(...findAll(child, name));
  }
  return matches;
};

const findChild = (node: XmlNode, name: string): XmlNode | undefined =>
  node.children.find((child) => child.name === name);

const getFirstChildText = (node: XmlNode, names: string[]): string => {
  for (const name of names) {
    const text = collectText(findChild(node, name));
    if (text) return text;
  }
  return "";
};

const getAtomLink = (entry: XmlNode): string => {
  const links = entry.children.filter((child) => child.name === "link");
  const alternate = links.find((link) => link.attributes.rel === "alternate");
  const selected = alternate ?? links[0];
  if (!selected) return "";
  const href = selected.attributes.href;
  if (href) return href.trim();
  return collectText(selected);
};

const parseRssItems = (root: XmlNode): FeedItem[] => {
  const items = findAll(root, "item");
  return items.map((item) => ({
    title: collectText(findChild(item, "title")),
    link: collectText(findChild(item, "link")),
    pubDate: collectText(findChild(item, "pubDate")),
    description: getFirstChildText(item, ["description", "content:encoded"]),
  }));
};

const parseAtomEntries = (root: XmlNode): FeedItem[] => {
  const entries = findAll(root, "entry");
  return entries.map((entry) => ({
    title: collectText(findChild(entry, "title")),
    link: getAtomLink(entry),
    pubDate: getFirstChildText(entry, ["updated", "published"]),
    description: getFirstChildText(entry, ["summary", "content"]),
  }));
};

const parseFeed = (xml: string): FeedItem[] => {
  const root = parseXml(xml);
  const items = findAll(root, "item");
  const entries = findAll(root, "entry");
  const isAtom = entries.length > 0 && items.length === 0;

  if (isAtom) {
    return parseAtomEntries(root);
  }

  return parseRssItems(root);
};

const fetchFeed = async (url: string): Promise<string> => {
  const response = await fetch(url, {
    redirect: "follow",
    signal: AbortSignal.timeout(30000),
    headers: {
      "User-Agent": "moltbot-web-scraper/1.0",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch feed: ${response.status} ${response.statusText}`);
  }

  return response.text();
};

const runCli = async () => {
  const [feedUrl] = process.argv.slice(2);
  if (!feedUrl) {
    console.error("Usage: bun run scrape-rss.ts <feed-url>");
    process.exit(1);
  }

  const validation = await validateUrl(feedUrl);
  if (!validation.valid) {
    console.error(validation.error ?? "URL validation failed");
    process.exit(1);
  }

  try {
    const xml = await fetchFeed(feedUrl);
    const items = parseFeed(xml);
    process.stdout.write(JSON.stringify(items, null, 2) + "\n");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to parse feed";
    console.error(message);
    process.exit(1);
  }
};

if (import.meta.main) {
  runCli();
}
