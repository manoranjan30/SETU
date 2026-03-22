import { readFileSync } from "fs";
import { join } from "path";

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: node plugins-sdk/inspect-plugin.ts <plugin-folder>");
  process.exit(1);
}

const plugin = JSON.parse(readFileSync(join(folder, "plugin.json"), "utf8"));
const permissions = JSON.parse(
  readFileSync(join(folder, "permissions.json"), "utf8"),
);
const menus = JSON.parse(readFileSync(join(folder, "menus.json"), "utf8"));
const pages = JSON.parse(readFileSync(join(folder, "pages.json"), "utf8"));
const widgets = JSON.parse(readFileSync(join(folder, "widgets.json"), "utf8"));
const reports = JSON.parse(readFileSync(join(folder, "reports.json"), "utf8"));
const workflows = JSON.parse(
  readFileSync(join(folder, "workflows.json"), "utf8"),
);

console.log(JSON.stringify({
  pluginKey: plugin.pluginKey,
  name: plugin.name,
  version: plugin.version,
  permissions: permissions.length,
  menus: menus.length,
  pages: pages.length,
  widgets: widgets.length,
  reports: reports.length,
  workflows: workflows.length,
}, null, 2));
