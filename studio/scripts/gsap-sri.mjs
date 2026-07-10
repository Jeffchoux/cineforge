#!/usr/bin/env node
/**
 * Recalcule le hash SRI GSAP et vérifie l'alignement version + intégrité entre
 * les trois sources de vérité :
 *   - la constante `GSAP_VERSION` / `GSAP_SRI` de src/lib/engine/compiler.ts
 *   - la copie vendored public/vendor/gsap.min.js
 *   - la plage déclarée dans package.json
 *
 * Procédure lors d'un bump GSAP :
 *   1. Mettre à jour "gsap" dans package.json puis `npm install`.
 *   2. `cp node_modules/gsap/dist/gsap.min.js public/vendor/gsap.min.js`
 *   3. `npm run gsap:sri` → copier la valeur SRI affichée dans compiler.ts,
 *      et mettre à jour GSAP_VERSION.
 *   4. `npm test` — le test tests/unit/gsap-integrity.test.ts verrouille le tout.
 *
 * Le test unitaire fait échouer la CI si l'alignement casse ; ce script est
 * l'outil d'aide au recalcul (aucune dépendance réseau requise).
 */
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../", import.meta.url));
const vendored = readFileSync(`${root}public/vendor/gsap.min.js`);
const sri = "sha384-" + createHash("sha384").update(vendored).digest("base64");

const header = vendored.toString("utf8", 0, 200);
const version = header.match(/GSAP (\d+\.\d+\.\d+)/)?.[1] ?? "inconnue";

const pkg = JSON.parse(readFileSync(`${root}package.json`, "utf8"));
const declared = pkg.dependencies?.gsap ?? "absent";

console.log(`Version vendored   : ${version}`);
console.log(`package.json gsap  : ${declared}`);
console.log(`SRI (sha384)       : ${sri}`);
console.log(`\nCDN                : https://cdn.jsdelivr.net/npm/gsap@${version}/dist/gsap.min.js`);
console.log("\n→ Reporter GSAP_VERSION et GSAP_SRI ci-dessus dans src/lib/engine/compiler.ts.");
