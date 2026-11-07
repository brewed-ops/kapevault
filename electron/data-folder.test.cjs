const test = require("node:test");
const assert = require("node:assert/strict");
const { execFileSync } = require("node:child_process");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { prepareDataFolder } = require("./data-folder.cjs");

test("a normal data folder is created and nothing is reported", () => {
  const dir = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "kapevault-data-")), "Roaming", "KAPEVault");
  assert.equal(prepareDataFolder(dir), null);
  assert.ok(fs.statSync(dir).isDirectory());
});

// A user's PC (2026-10-12): AppData\Roaming pointed at a folder that did not exist, and the raw ENOENT
// from mkdir crashed the app with "A JavaScript error occurred in the main process".
test("a Roaming folder that points nowhere gives a plain message, not a throw", { skip: process.platform !== "win32" }, () => {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), "kapevault-data-"));
  const roaming = path.join(home, "Roaming");
  execFileSync("cmd", ["/c", "mklink", "/J", roaming, path.join(home, "moved-away")], { stdio: "ignore" });
  try {
    const dir = path.join(roaming, "KAPEVault");
    const problem = prepareDataFolder(dir);
    assert.ok(problem, "a problem is reported");
    assert.equal(problem.title, "KAPEVault could not start");
    assert.match(problem.message, /could not create the folder it keeps your vault in/);
    assert.ok(problem.message.includes(dir), "names the folder");
    assert.ok(problem.message.includes(roaming), "names the folder above it");
    assert.match(problem.message, /moved, redirected or on a drive that is not connected/);
    assert.match(problem.message, /Nothing was created or changed/);
    assert.match(problem.message, /ENOENT/);
  } finally {
    fs.rmdirSync(roaming);
  }
});

test("any other refusal is reported the same way, with its own code", () => {
  const refuse = { mkdirSync: () => { throw Object.assign(new Error("operation not permitted"), { code: "EPERM" }); } };
  const problem = prepareDataFolder("C:\\Users\\Test User\\AppData\\Roaming\\KAPEVault", refuse);
  assert.ok(problem);
  assert.match(problem.message, /EPERM/);
  assert.ok(problem.message.includes("C:\\Users\\Test User\\AppData\\Roaming"));
});
