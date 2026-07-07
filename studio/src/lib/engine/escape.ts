/**
 * Échappement HTML — toute chaîne fournie par l'utilisateur passe ici
 * avant d'être insérée dans une composition (défense XSS, OWASP A03).
 */

const HTML_ESCAPES: Record<string, string> = {
  "&": "&amp;",
  "<": "&lt;",
  ">": "&gt;",
  '"': "&quot;",
  "'": "&#39;",
};

export function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (ch) => HTML_ESCAPES[ch]);
}

/**
 * Échappement pour insertion dans une chaîne JS single-quoted
 * à l'intérieur d'un <script> (narration, ids).
 */
export function escapeJsString(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n")
    .replace(/\r/g, "")
    .replace(/<\/script/gi, "<\\/script");
}
