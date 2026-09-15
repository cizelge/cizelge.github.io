// Statik dışa aktarımdan sonra çalışır (GitHub Pages).
// Next.js ön yükleme dosyalarını klasör olarak yazıyor: out/ozyegin/gecis/__next.ozyegin/gecis/__PAGE__.txt
// Tarayıcı ise noktalı adla istiyor:              out/ozyegin/gecis/__next.ozyegin.gecis.__PAGE__.txt
// Dosya sunucusu adresleri yeniden yazamadığı için noktalı adlarla kopyalarını oluşturuyoruz.
import fs from "node:fs";
import path from "node:path";

const root = path.resolve(process.argv[2] ?? "out");
let copied = 0;

function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (!entry.isDirectory()) continue;
    if (entry.name.startsWith("__next.")) flatten(dir, full, entry.name);
    else walk(full);
  }
}

/** base: sayfanın klasörü; segDir: "__next.<ilk parça>" klasörü. İçindeki her dosyayı noktalı ada kopyalar. */
function flatten(base, segDir, prefix) {
  const stack = [[segDir, prefix]];
  while (stack.length > 0) {
    const [dir, name] = stack.pop();
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      const dotted = `${name}.${entry.name}`;
      if (entry.isDirectory()) stack.push([full, dotted]);
      else {
        const target = path.join(base, dotted);
        if (!fs.existsSync(target)) {
          fs.copyFileSync(full, target);
          copied++;
        }
      }
    }
  }
}

if (!fs.existsSync(root)) {
  console.error(`${root} yok; önce STATIC_EXPORT=1 ile derle.`);
  process.exit(1);
}
walk(root);
// Jekyll'in "_" ile başlayan klasörleri (_next) atmaması için.
fs.writeFileSync(path.join(root, ".nojekyll"), "");
console.log(`${copied} ön yükleme dosyası noktalı adla kopyalandı.`);
