// The mock vault's sample items, stored the way the vault file stores them (secrets
// included), so the mock host runs them through core/ exactly as the real host will. Mock names only.
import { addDays, today } from "@core";

const TOTP = (issuer: string, account: string, secret: string) =>
  `otpauth://totp/${encodeURIComponent(`${issuer}:${account}`)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`;

export const MOCK_MASTER = "demo"; // the mock's master password
const REUSED = "t7#Qm-Vx9!pLr2wK";
const day = (n: number) => addDays(today(), n);

const SPACES = {
  personal: { id: "sp-personal", name: "Personal", kind: "personal" },
  nw: { id: "sp-nw", name: "Northwind Dental", kind: "client" },
  hp: { id: "sp-hp", name: "Harbor & Pine", kind: "client" },
  lc: { id: "sp-lc", name: "Lumen Coffee Co.", kind: "client" },
} as const;

const base = (id: string, title: string, space: keyof typeof SPACES, extra: Record<string, unknown> = {}) => ({
  id,
  title,
  spaceId: SPACES[space].id,
  tags: [],
  favorite: false,
  notes: "",
  updatedAt: day(-1),
  ...extra,
});

export const NOTE_ID = "e-notes";
export const CONFLICT_ID = "e-notes-copy";

// ?mock&links swaps in a links-first sample for product screenshots. Dev-only like the rest of this file.
function linksVault() {
  const L = (id: string, title: string, linkType: string, location: string, extra: Record<string, unknown> = {}) =>
    ({ ...base(id, title, "nw", extra), kind: "link", linkType, location });
  return {
    spaces: Object.values(SPACES).map((s) => (s.id === "sp-nw" ? { ...s, name: "Northwind Studio" } : { ...s })),
    entries: [
      L("l-brand", "Brand assets", "drive", "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv", { favorite: true }),
      L("l-q4", "Q4 reports", "drive", "https://drive.google.com/drive/folders/1ZyXwVuTsRqPoNmLkJiHgFe", { favorite: true }),
      L("l-prop", "Proposal - Northwind", "doc", "https://docs.google.com/document/d/1ExampleDocId0000000000"),
      L("l-files", "Client files", "folder", "D:\\Clients\\Northwind Studio"),
      L("l-site", "Northwind website", "web", "https://northwind.example.com"),
      L("l-canva", "Canva board", "web", "https://www.canva.com/design/example"),
      L("l-wiki", "Notion wiki", "web", "https://www.notion.so/example-wiki"),
      L("l-ghl", "GoHighLevel dashboard", "web", "https://app.gohighlevel.com"),
      { ...base("e-github", "GitHub", "personal"), kind: "login", username: "sam.reyes@example.com", password: REUSED, url: "https://github.com", signIn: "password", passwordChangedAt: day(-20) },
      { ...base("e-gmail", "Gmail", "personal"), kind: "login", username: "sam.home@example.com", password: "Lantern-Mango-Quiet-47", url: "https://mail.google.com", signIn: "password", passwordChangedAt: day(-30) }, // gitleaks:allow
    ],
  };
}

export function mockVault() {
  if (new URLSearchParams(window.location.search).has("links")) return linksVault();
  return {
    spaces: Object.values(SPACES).map((s) => ({ ...s })),
    entries: [
      { ...base("e-canva", "Canva", "nw"), kind: "login", username: "sam.reyes@example.com", password: REUSED, url: "https://www.canva.com", signIn: "google", passwordChangedAt: day(-60) },
      { ...base("e-cf", "Cloudflare API", "hp"), kind: "key", keyId: "cf-token-7f3a", secret: "cf-token-0123-example", url: "https://dash.cloudflare.com", expires: day(12) },
      { ...base("e-figma", "Figma", "lc"), kind: "login", username: "sam.reyes@example.com", password: REUSED, url: "https://www.figma.com", signIn: "password", passwordChangedAt: day(-90) },
      {
        ...base("e-github", "GitHub", "personal", { favorite: true }),
        kind: "login",
        username: "sam.reyes@example.com",
        password: REUSED,
        url: "https://github.com",
        signIn: "password",
        totp: TOTP("GitHub", "sam.reyes@example.com", "JBSWY3DPEHPK3PXP"),
        history: [{ password: "gh-Old-Pass-2025!", changedAt: day(-120) }],
        passwordChangedAt: day(-120),
      },
      { ...base("e-gmail", "Gmail", "personal", { favorite: true }), kind: "login", username: "sam.home@example.com", password: "Lantern-Mango-Quiet-47", url: "https://mail.google.com", signIn: "password", totp: TOTP("Google", "sam.home@example.com", "KRSXG5CTMVRXEZLUKN2XAZLS"), passwordChangedAt: day(-30) }, // gitleaks:allow
      { ...base("e-router", "Home Wi-Fi router", "personal", { brand: "tp-link" }), kind: "device", type: "router", model: "Archer AX55", ssid: "Northwind-5G", wifiPassword: "sampaguita-2048", adminUrl: "192.168.0.1", adminUser: "admin", adminPassword: "Rtr!8842" }, // gitleaks:allow
      { ...base("e-gcash", "Mama GCash", "personal", { heldFor: "Mama" }), kind: "note", body: "Name: Mama\nRelation: Mother\nWallet or bank: GCash\nNumber: 09170000000\nAccount name: MA*** D*** C." },
      { ...base("e-notion", "Notion", "lc"), kind: "login", username: "sam.reyes@example.com", password: "", url: "https://www.notion.so", signIn: "google", viaEntryId: "e-gmail" },
      { ...base("e-umid", "UMID", "personal"), kind: "id", idType: "UMID", idNumber: "0028-1234567-8" },
      { ...base("e-passport", "Passport", "personal"), kind: "thing", room: "Bedroom", spot: "Top drawer, blue folder", grab: 1, expires: day(900) },
      { ...base(NOTE_ID, "Server recovery steps", "hp"), kind: "note", body: "1. SSH in as ops.\n2. Restart the queue worker.\n3. Check the backup job ran." },
      {
        ...base(CONFLICT_ID, `Server recovery steps (conflict copy, Pixel 8, ${day(-1)})`, "hp"),
        kind: "note",
        body: "1. SSH in as ops. 2. Restart the queue...",
      },
      { ...base("e-slack", "Slack", "hp"), kind: "login", username: "sam@harborpine.example", password: "Harbor-Pine-Slack-2291", url: "https://harborpine.slack.com", signIn: "password", totp: TOTP("Slack", "sam@harborpine.example", "MFRGGZDFMZTWQ2LKNNWG23TP"), passwordChangedAt: day(-45) },
      { ...base("e-bdo", "BDO Online", "personal"), kind: "login", username: "sam.ops", password: "Bdo#Online-5521", url: "https://online.bdo.com.ph", signIn: "password", passwordChangedAt: day(-430) },
      { ...base("e-contracts", "Signed contracts", "hp"), kind: "link", linkType: "folder", location: "D:\\Clients\\Harbor & Pine\\Contracts" },
    ],
  };
}
