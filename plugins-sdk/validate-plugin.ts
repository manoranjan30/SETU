import { existsSync, readFileSync } from "fs";
import { join } from "path";

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: node plugins-sdk/validate-plugin.ts <plugin-folder>");
  process.exit(1);
}

const requiredFiles = [
  "plugin.json",
  "permissions.json",
  "menus.json",
  "pages.json",
  "widgets.json",
  "reports.json",
  "workflows.json",
  "settings.schema.json",
];

for (const file of requiredFiles) {
  const path = join(folder, file);
  if (!existsSync(path)) {
    console.error(`Missing required file: ${file}`);
    process.exit(1);
  }
}

const plugin = JSON.parse(readFileSync(join(folder, "plugin.json"), "utf8"));
if (!plugin.pluginKey || !plugin.name || !plugin.version) {
  console.error("plugin.json must include pluginKey, name, and version.");
  process.exit(1);
}

const permissions = JSON.parse(
  readFileSync(join(folder, "permissions.json"), "utf8"),
);
const expectedPrefix = `PLUGIN.${String(plugin.pluginKey).toUpperCase()}.`;
for (const permission of permissions) {
  if (!String(permission.code || "").startsWith(expectedPrefix)) {
    console.error(
      `Invalid permission '${permission.code}'. Expected prefix ${expectedPrefix}`,
    );
    process.exit(1);
  }
}

console.log("Plugin structure is valid.");
