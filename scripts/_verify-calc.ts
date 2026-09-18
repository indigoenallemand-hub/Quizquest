import "dotenv/config";
import { generateVariables, evaluateFormula, renderEnonce } from "@/lib/calc";
import { calculContentSchema } from "@/lib/schemas";

import { CALC_CONVERSIONS } from "@/scripts/migrate-json";

let failures = 0;
for (const [name, defs] of Object.entries(CALC_CONVERSIONS)) {
  for (const [i, def] of defs.entries()) {
    const content = calculContentSchema.parse(def.content);
    for (let trial = 0; trial < 200; trial++) {
      const vars = generateVariables(content);
      try {
        const expected = evaluateFormula(content, vars);
        if (!Number.isFinite(expected)) throw new Error("non-finite");
        if (trial === 0) {
          console.log(`${name}[${i}] sample: ${renderEnonce(content.enonce, vars, content)} => ${expected}${content.unite_reponse ?? ""}`);
        }
      } catch (err) {
        failures++;
        console.error(`${name}[${i}] trial ${trial} FAILED with vars=${JSON.stringify(vars)}:`, (err as Error).message);
      }
    }
  }
}
console.log(failures === 0 ? "\nAll formulas OK across 200 random trials each." : `\n${failures} failures.`);
process.exitCode = failures === 0 ? 0 : 1;
