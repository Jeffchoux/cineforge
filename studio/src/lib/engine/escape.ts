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
