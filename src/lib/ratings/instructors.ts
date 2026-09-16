// Hoca adından adres parçası: "EMRE SEFER" -> "emre-sefer". Türkçe harfler karşılıklarına çevrilir.

const MAP: Record<string, string> = { ç: "c", ğ: "g", ı: "i", ö: "o", ş: "s", ü: "u", â: "a", î: "i", û: "u" };

export function instructorSlug(name: string): string {
  return name
    .trim()
    .toLocaleLowerCase("tr")
    .replace(/[çğıöşüâîû]/g, (c) => MAP[c] ?? c)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}
