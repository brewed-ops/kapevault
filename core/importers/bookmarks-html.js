// Browser bookmarks: the "Netscape bookmark file" Chrome, Edge, Brave and Firefox export as HTML. Read with
// regexes, no DOM (core also runs in the phone's WebView). Folders become one tag (the path), each web
// bookmark becomes a link. Not a secret: the host never deletes this file (electron/import-file.cjs).
import { collector, hostOf } from "./common.js";

export const label = "Browser bookmarks (HTML)";

/** @param {string} body the file without its BOM */
export const matches = (body) => /<!doctype\s+netscape-bookmark-file-1/i.test(body.slice(0, 2048));

// The browsers' own top folders say where a bookmark was kept, not what it is about.
const ROOT_FOLDERS = new Set(["bookmarks bar", "bookmarks toolbar", "other bookmarks", "bookmarks menu", "favorites bar", "favourites bar", "mobile bookmarks"]);
const DRIVE_HOSTS = new Set(["drive.google.com", "docs.google.com"]);
const ENTITIES = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** @param {string} s */
function decode(s) {
  return s.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, name) => {
    if (name[0] !== "#") return ENTITIES[name.toLowerCase()];
    const code = name[1].toLowerCase() === "x" ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
    return code > 0 && code <= 0x10ffff && !(code >= 0xd800 && code <= 0xdfff) ? String.fromCodePoint(code) : whole;
  });
}

const attr = (attrs, name) => {
  const m = new RegExp(`(?:^|\\s)${name}\\s*=\\s*(?:"([^"]*)"|'([^']*)'|([^\\s>]+))`, "i").exec(attrs);
  return m ? decode(m[1] ?? m[2] ?? m[3]) : "";
};

/** @param {string} body the whole file without its BOM */
export function parse(body) {
  const c = collector();
  // One frame per open <DL>: its folder name (null for the unnamed top list) and whether anything under it was kept.
  const frames = [];
  let pendingFolder = null;
  let row = 0;
  // A tag, then the text up to the next tag (a title or folder name); an unclosed tag cannot make this slow.
  const tags = /<(\/?)(dl|h3|a)\b([^>]*)>([^<]*)/gi;
  for (const m of body.matchAll(tags)) {
    const [, closing, name, attrs, text] = m;
    const tag = name.toLowerCase();
    if (tag === "h3") {
      if (!closing) pendingFolder = decode(text).trim();
    } else if (tag === "dl") {
      if (!closing) {
        frames.push({ name: pendingFolder, used: false });
        pendingFolder = null;
      } else {
        const done = frames.pop();
        if (done?.name && !done.used) c.skipEmpty(row, "Empty folder");
        if (done?.used && frames.length) frames[frames.length - 1].used = true;
      }
    } else if (!closing) {
      row += 1;
      if (addBookmark(c, row, attrs, decode(text).trim(), frames)) for (const f of frames) f.used = true;
    }
  }
  return c.result();
}

// Returns true when the bookmark was kept (or was a copy of one that was).
function addBookmark(c, row, attrs, title, frames) {
  const href = attr(attrs, "href").trim();
  const scheme = /^([a-z][a-z0-9+.-]*):/i.exec(href)?.[1].toLowerCase().slice(0, 20);
  const lose = (reason, harmless = false) => {
    (harmless ? c.skipEmpty : c.skip)(row, reason);
    return false;
  };
  if (!href) return lose("Bookmark with no address", true);
  if (scheme === "place") return lose("Firefox smart folder (no web address)", true);
  if (scheme !== "http" && scheme !== "https") return lose(scheme === "javascript" ? "Bookmarklet (javascript:), not a web address" : `Address starts with ${scheme ?? "no scheme"}:, only http and https links are imported`);
  let url;
  try {
    url = new URL(href);
  } catch {
    return lose("Not a valid web address");
  }
  if ([...href].some((ch) => ch.charCodeAt(0) < 32 || ch.charCodeAt(0) === 127)) return lose("Not a valid web address");
  const path = frames.map((f) => f.name).filter((n) => n && !ROOT_FOLDERS.has(n.toLowerCase()));
  c.link(row, {
    title: title || hostOf(href),
    location: href,
    linkType: DRIVE_HOSTS.has(url.hostname) ? "drive" : "web",
    tags: path.length ? [path.join(" / ")] : [],
  });
  return true;
}
