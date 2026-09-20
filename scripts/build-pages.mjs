// GitHub Pages için statik derleme: STATIC_EXPORT=1 ile next build, ardından ön yükleme dosyası düzeltmesi.
// Windows ve Linux'ta aynı çalışsın diye ortam değişkeni burada verilir.
import { spawnSync } from "node:child_process";

const env = { ...process.env, STATIC_EXPORT: "1", SITE_URL: process.env.SITE_URL ?? "https://ozuhelper.github.io" };
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { stdio: "inherit", env, shell: process.platform === "win32" });
  if (r.status !== 0) process.exit(r.status ?? 1);
};
run("npx", ["next", "build"]);
run("node", ["scripts/fix-export-segments.mjs", "out"]);
