import { readFileSync, writeFileSync } from "fs";
import { basename, join } from "path";

const folder = process.argv[2];
if (!folder) {
  console.error("Usage: node plugins-sdk/pack-plugin.ts <plugin-folder>");
  process.exit(1);
}

const readJson = (file: string) =>
  JSON.parse(readFileSync(join(folder, file), "utf8"));

const bundle = {
  plugin: readJson("plugin.json"),
  permissions: readJson("permissions.json"),
  menus: readJson("menus.json"),
  pages: readJson("pages.json"),
  widgets: readJson("widgets.json"),
  reports: readJson("reports.json"),
  workflows: readJson("workflows.json"),
  settingsSchema: readJson("settings.schema.json"),
};

const outputPath = join(folder, "plugin.bundle.json");
writeFileSync(outputPath, JSON.stringify(bundle, null, 2), "utf8");

console.log(`Packed ${basename(folder)} -> ${outputPath}`);
