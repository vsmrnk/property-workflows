// Куди повернути після входу (impl-template-versions-2 U6, AC-DSYS-08): лише локальний шлях цього застосунку.
// Перевіряємо так, як адресу прочитає браузер: парсер URL викидає табуляції й переноси та читає "\" як "/", тому
// "//host", "/\host" чи "/<tab>/host" ведуть на інший сайт — такі значення, як і порожні, ведуть на головну.
const BASE = "http://local.invalid";

export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/")) return "/";
  let url: URL;
  try {
    url = new URL(value, BASE);
  } catch {
    return "/";
  }
  if (url.origin !== BASE || /[\t\n\r]/.test(value) || value.startsWith("//") || value.startsWith("/\\")) return "/";
  return url.pathname + url.search + url.hash;
}
