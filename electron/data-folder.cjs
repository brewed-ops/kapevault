// Creates the folder the vault lives in. A PC whose AppData was moved or redirected to a place that is
// gone makes mkdir fail; that must reach the user as a plain message, never as an uncaught exception.
const fs = require("node:fs");
const path = require("node:path");

/**
 * @param {string} dir
 * @param {{ mkdirSync: (dir: string, options: { recursive: true }) => unknown }} [files]
 * @returns {{ title: string, message: string } | null} null once the folder exists
 */
function prepareDataFolder(dir, files = fs) {
  try {
    files.mkdirSync(dir, { recursive: true });
    return null;
  } catch (e) {
    const code = /** @type {NodeJS.ErrnoException} */ (e).code ?? "unknown error";
    return {
      title: "KAPEVault could not start",
      message:
        `KAPEVault could not create the folder it keeps your vault in:\n${dir}\n\n` +
        `Windows refused (${code}). This usually means the folder above it, ${path.dirname(dir)}, was moved, redirected or on a drive that is not connected. ` +
        "Check that it opens in File Explorer, then start KAPEVault again.\n\nNothing was created or changed.",
    };
  }
}

module.exports = { prepareDataFolder };
