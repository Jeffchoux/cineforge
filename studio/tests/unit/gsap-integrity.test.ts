import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { GSAP_CDN, GSAP_SRI, GSAP_VERSION } from "../../src/lib/engine";

/**
 * Verrou anti-dérive GSAP. Le bug historique : le CDN + le hash SRI étaient
 * épinglés sur 3.14.2 alors que package.json et la copie vendored déclaraient
 * 3.15.0 — un navigateur strict aurait refusé d'exécuter le bundle (intégrité
 * invalide), en silence côté build. Ces tests font échouer la CI dès qu'une des
 * trois sources (constante compiler, package.json, vendored) diverge, ou que le
 * SRI n'est plus recalculé après un bump.
 */

const root = fileURLToPath(new URL("../../", import.meta.url));

function sha384Base64(bytes: Buffer): string {
  return "sha384-" + createHash("sha384").update(bytes).digest("base64");
}

describe("intégrité GSAP (anti-dérive)", () => {
  const vendored = readFileSync(`${root}public/vendor/gsap.min.js`);
  const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8")) as {
    dependencies: Record<string, string>;
  };

  it("le SRI épinglé correspond au hash réel de la copie vendored", () => {
    expect(sha384Base64(vendored)).toBe(GSAP_SRI);
  });

  it("l'URL CDN pointe sur la version déclarée", () => {
    expect(GSAP_CDN).toContain(`gsap@${GSAP_VERSION}/`);
  });

  it("la copie vendored est bien la version épinglée", () => {
    // L'en-tête de licence GSAP contient « GSAP 3.15.0 ».
    expect(vendored.toString("utf8", 0, 200)).toContain(`GSAP ${GSAP_VERSION}`);
  });

  it("package.json déclare une plage compatible avec la version épinglée", () => {
    // On tolère le préfixe ^ / ~ / = et exige le même major.minor.patch de base.
    const declared = pkg.dependencies.gsap.replace(/^[\^~=><\s]+/, "");
    expect(declared).toBe(GSAP_VERSION);
  });
});
