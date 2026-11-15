// Calcule l'empreinte à mettre dans la variable PASSWORD_HASH.
// Usage : node scripts/empreinte-mot-de-passe.mjs   (le mot de passe est demandé, il n'est ni affiché ni enregistré)
import { randomBytes, scryptSync } from "node:crypto";
import { createInterface } from "node:readline";

const rl = createInterface({ input: process.stdin, output: process.stderr, terminal: true });
rl._writeToOutput = () => {}; // n'affiche pas la saisie
process.stderr.write("Mot de passe : ");
rl.question("", (password) => {
  rl.close();
  process.stderr.write("\n");
  if (password.length < 10) {
    console.error("Trop court : au moins 10 caractères.");
    process.exit(1);
  }
  const salt = randomBytes(16);
  console.log(`${salt.toString("hex")}:${scryptSync(password, salt, 64).toString("hex")}`);
});
