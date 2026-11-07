// Links-first product shots of the REAL window (acrylic glass is invisible to page screenshots),
// light + dark, from a throwaway mock vault. Modelled on design-shots.cjs.
// Run: npm run build && node scripts/links-shots.cjs   -> PNGs in %TEMP%\kapevault-links\ (pc-main.png, pc-main-dark.png)
const { _electron: electron } = require("./playwright.cjs");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const APP = path.resolve(__dirname, "..");
const OUT = path.join(os.tmpdir(), "kapevault-links");
fs.mkdirSync(OUT, { recursive: true });
const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "kapevault-links-data-"));
const PASS = "design kettle harbor pass orbit gazelle";
const OPEN = process.env.LINKS_OPEN || "Brand assets";

async function screen(app, name) {
  const b = await app.evaluate(({ BrowserWindow, screen: display }) => {
    const w = BrowserWindow.getAllWindows().find((x) => !x.webContents.getURL().includes("#quick"));
    w.focus();
    return { ...w.getBounds(), scale: display.getPrimaryDisplay().scaleFactor };
  });
  await new Promise((r) => setTimeout(r, 700));
  const px = (n) => String(Math.round(n * b.scale));
  execFileSync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", path.join(__dirname, "capture-window.ps1"),
    px(b.x), px(b.y), px(b.width), px(b.height), path.join(OUT, name)]);
}

(async () => {
  const app = await electron.launch({
    executablePath: require(`${APP}/node_modules/electron`),
    args: [APP],
    env: { ...Object.fromEntries(Object.entries(process.env).filter(([k]) => k !== "ELECTRON_RUN_AS_NODE")), KAPEVAULT_DATA_DIR: dataDir, KAPEVAULT_AUTO_LOCK_SECONDS: "86400", KAPEVAULT_AIRWALL_FAKE: "on", KAPEVAULT_OCR_FAKE: "label", KAPEVAULT_ALLOW_CAPTURE: "1" },
  });
  const page = await app.firstWindow();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.waitForURL((u) => u.protocol === "app:" || u.protocol === "http:", { waitUntil: "domcontentloaded" });
  await page.getByPlaceholder("Master password", { exact: true }).fill(PASS);
  await page.getByPlaceholder("Confirm master password").fill(PASS);
  await page.keyboard.press("Enter");
  await page.getByText("Nothing here yet").waitFor({ timeout: 15000 });

  await page.evaluate(async () => {
    const b = window.kapevault;
    const v = (await b.addSpace("Northwind Studio")).vault;
    const client = v.spaces.find((s) => s.name === "Northwind Studio").id;
    const personal = v.spaces.find((s) => s.kind === "personal").id;
    await b.addSpace("Bluebird Bakery");
    const base = { tags: [], favorite: false, notes: "" };
    const link = (x) => b.saveEntry({ ...base, kind: "link", spaceId: client, ...x });
    await link({ title: "Brand assets", linkType: "drive", location: "https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOpQrStUv", favorite: true, notes: "Logos, fonts and brand guide." });
    await link({ title: "Q4 reports", linkType: "drive", location: "https://drive.google.com/drive/folders/1ZyXwVuTsRqPoNmLkJiHgFe", favorite: true });
    await link({ title: "Proposal - Northwind", linkType: "doc", location: "https://docs.google.com/document/d/1ExampleDocId0000000000" });
    await link({ title: "Client files", linkType: "folder", location: "D:\\Clients\\Northwind Studio" });
    await link({ title: "Northwind website", linkType: "web", location: "https://northwind.example.com" });
    await link({ title: "Canva board", linkType: "web", location: "https://www.canva.com/design/example" });
    await link({ title: "Notion wiki", linkType: "web", location: "https://www.notion.so/example-wiki" });
    await link({ title: "GoHighLevel dashboard", linkType: "web", location: "https://app.gohighlevel.com" });
    await b.saveEntry({ ...base, kind: "login", spaceId: client, title: "Northwind admin login", username: "sam@northwind.example", password: "x-123456", url: "https://northwind.example.com/admin" });
    await b.saveEntry({ ...base, kind: "login", spaceId: personal, title: "GitHub", username: "sam.reyes@example.com", password: "x-123456", url: "https://github.com" });
  });
  await page.getByRole("button", { name: "Lock vault" }).click();
  await page.waitForTimeout(500);
  await page.getByPlaceholder("Master password").fill(PASS);
  await page.keyboard.press("Enter");
  await page.locator("section li").first().waitFor({ timeout: 15000 });

  const theme = async (name) => {
    await page.evaluate((t) => window.kapevault.setSettings({ theme: t }), name);
    await page.waitForTimeout(500);
  };
  // The site's PC shots are 1513x943 px; the default window is 1440x900, so size it to match (display scale 1).
  await app.evaluate(({ BrowserWindow }) => {
    const w = BrowserWindow.getAllWindows().find((x) => !x.webContents.getURL().includes("#quick"));
    w.setBounds({ x: 40, y: 20, width: 1513, height: 943 });
  });
  await page.waitForTimeout(600);
  await page.locator("aside").getByText("Northwind Studio", { exact: true }).first().click();
  await page.waitForTimeout(400);
  await page.locator("section li", { hasText: OPEN }).click();
  await page.waitForTimeout(700);
  await theme("classic");
  await screen(app, "pc-main.png");
  await theme("dark");
  await screen(app, "pc-main-dark.png");
  await theme("classic");
  await app.close();
  console.log(`shots in ${OUT}`, errors.length ? `errors: ${errors.join(" | ")}` : "(no page errors)");
})();
