import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { lostRows, parseExport } from "./index.js";
import { MAX_IMPORT_ITEMS, importEntries } from "../import.js";

const fixture = (name) => fs.readFileSync(path.join(import.meta.dirname, "fixtures", name), "utf8");
const run = (name) => parseExport(fixture(name));
const vault = () => ({ spaces: [{ id: "p", name: "Personal", kind: "personal" }], entries: [] });
const reasons = (r, harmless) => r.skipped.filter((s) => Boolean(s.harmless) === harmless).map((s) => s.reason);

test("Chrome bookmarks: nested folders become one tag, root folders are left out", () => {
  const r = run("chrome-bookmarks.html");
  assert.equal(r.source, "bookmarks");
  const tags = Object.fromEntries(r.items.map((i) => [i.title, i.tags]));
  assert.deepEqual(tags["Mock Client Shared Drive"], ["Mock Client"]);
  assert.deepEqual(tags["Mock Plain Http"], []); // only "Other bookmarks" above it
  assert.deepEqual(tags["Brief & Notes"], ["Mock Client"]);
  assert.deepEqual(r.items.find((i) => i.title.startsWith("Q1")).tags, ["Mock Client / Reports <2026>"]);
  assert.ok(r.items.every((i) => i.kind === "link"));
});

test("Chrome bookmarks: entities are decoded, Drive and Docs are drive links, the rest web", () => {
  const r = run("chrome-bookmarks.html");
  const q1 = r.items.find((i) => i.title.startsWith("Q1"));
  assert.equal(q1.title, `Q1 "Draft" 'one' A`);
  assert.equal(q1.location, "https://example.com/report?a=1&b=2");
  const type = (title) => r.items.find((i) => i.title === title).linkType;
  assert.equal(type("Mock Client Shared Drive"), "drive");
  assert.equal(type("Brief & Notes"), "drive");
  assert.equal(type("Mock Plain Http"), "web");
});

test("Chrome bookmarks: an empty title becomes the host, two pages titled Home both come in", () => {
  const r = run("chrome-bookmarks.html");
  assert.ok(r.items.some((i) => i.title === "example.net" && i.location === "https://example.net/"));
  const homes = r.items.filter((i) => i.title.startsWith("Home"));
  assert.deepEqual(homes.map((h) => h.location).sort(), ["https://example.com/home", "https://www.example.org/home"]);
  const data = vault();
  const out = importEntries(data, r.items);
  assert.equal(out.added, r.items.length);
  assert.equal(data.entries.filter((e) => e.title.startsWith("Home")).length, 2);
});

test("Chrome bookmarks: only http and https come in; the rest is named and kept as lost", () => {
  const r = run("chrome-bookmarks.html");
  assert.equal(r.items.length, 7);
  assert.ok(r.items.every((i) => /^https?:\/\//.test(i.location)));
  assert.deepEqual(reasons(r, false).sort(), [
    "Address starts with chrome:, only http and https links are imported",
    "Address starts with file:, only http and https links are imported",
    "Bookmarklet (javascript:), not a web address",
  ]);
  assert.equal(lostRows(r.skipped).length, 3);
});

test("Chrome bookmarks: an empty folder and an exact copy are harmless skips", () => {
  const r = run("chrome-bookmarks.html");
  assert.deepEqual(reasons(r, true).sort(), ["Empty folder", "Same item as an earlier row"]);
});

test("Firefox bookmarks: its own root folders are left out, place: is a harmless skip", () => {
  const r = run("firefox-bookmarks.html");
  assert.equal(r.source, "bookmarks");
  const tags = Object.fromEntries(r.items.map((i) => [i.title, i.tags]));
  assert.deepEqual(tags, {
    "Mock Help": ["Mozilla Firefox"],
    "Mock Tools": [],
    "Mock Contract": ["Mock Client"],
    "Mock After": [],
  });
  assert.equal(r.items.find((i) => i.title === "Mock Contract").linkType, "drive");
  assert.deepEqual(reasons(r, true), ["Firefox smart folder (no web address)"]);
  assert.deepEqual(reasons(r, false), ["Address starts with about:, only http and https links are imported"]);
});

test("the doctype is found case-insensitively after a BOM, and only near the top", () => {
  const body = '<dl><dt><a href="https://example.com/x">Mock X</a></dl>';
  assert.equal(parseExport(`${String.fromCharCode(0xfeff)}<!doctype netscape-bookmark-file-1>${body}`).items[0].title, "Mock X");
  assert.equal(parseExport(`${"x".repeat(2100)}<!DOCTYPE NETSCAPE-Bookmark-file-1>${body}`), null);
});

test("a bookmark whose address has a control character or no scheme is not imported", () => {
  const r = parseExport('<!DOCTYPE NETSCAPE-Bookmark-file-1><DL><DT><A HREF="https://exa&#10;mple.com/&#1;">Mock A</A><DT><A HREF="example.com/b">Mock B</A><DT><A>Mock C</A></DL>');
  assert.equal(r.items.length, 0);
  assert.equal(lostRows(r.skipped).length, 2);
});

test("more bookmarks than the import cap are refused with a clear message", () => {
  const rows = Array.from({ length: MAX_IMPORT_ITEMS + 1 }, (_, i) => `<DT><A HREF="https://example.com/${i}">Mock ${i}</A>`).join("\n");
  assert.throws(() => parseExport(`<!DOCTYPE NETSCAPE-Bookmark-file-1><DL>${rows}</DL>`), /more than 5000 items/);
});

test("core's duplicate rule: same title and different location both import, an exact copy does not; logins still dedupe on their own fields", () => {
  const data = vault();
  const link = (location, title = "Home") => ({ kind: "link", title, linkType: "web", location });
  assert.equal(importEntries(data, [link("https://example.com/a"), link("https://example.com/b")]).added, 2);
  assert.equal(importEntries(data, [link("https://example.com/a"), link("https://example.com/c")]).added, 1);
  const login = (username) => ({ kind: "login", title: "Mock Site", username, password: "mock-pass-1" });
  assert.equal(importEntries(data, [login("one"), login("two")]).added, 2);
  assert.deepEqual(importEntries(data, [login("one")]), { added: 0, skipped: 1 });
});

test("a second import of the same file adds nothing", () => {
  const data = vault();
  const first = importEntries(data, run("chrome-bookmarks.html").items);
  const again = importEntries(data, run("chrome-bookmarks.html").items);
  assert.equal(again.added, 0);
  assert.equal(again.skipped, first.added);
});
