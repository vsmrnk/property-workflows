// Куди повернути після входу (impl-template-versions-2 U6, AC-DSYS-08): лише локальний шлях цього застосунку.
// "//host" і "/\host" браузер читає як іншу адресу — такі значення, як і порожні, ведуть на головну.
export function safeNextPath(value: unknown): string {
  if (typeof value !== "string" || !value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) {
    return "/";
  }
  return value;
}
