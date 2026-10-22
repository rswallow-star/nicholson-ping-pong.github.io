import { formatPlayerName } from "../lib/formatName";

function assert(condition: boolean, msg: string) {
  if (!condition) {
    console.error(`FAIL: ${msg}`);
    process.exit(1);
  } else {
    console.log(`PASS: ${msg}`);
  }
}

console.log("=== TESTING NICKNAME FORMATTING ===");

// 1. Two-word name
assert(
  formatPlayerName("Milo Vercelletto", "The Chosen One") === 'Milo "The Chosen One" Vercelletto',
  'Milo Vercelletto + The Chosen One -> Milo "The Chosen One" Vercelletto'
);

// 2. Extra quotes in input
assert(
  formatPlayerName("Milo Vercelletto", '"The Chosen One"') === 'Milo "The Chosen One" Vercelletto',
  'Milo Vercelletto + "The Chosen One" -> Milo "The Chosen One" Vercelletto'
);

// 3. Curly quotes in input
assert(
  formatPlayerName("Milo Vercelletto", '“The Chosen One”') === 'Milo "The Chosen One" Vercelletto',
  'Milo Vercelletto + “The Chosen One” -> Milo "The Chosen One" Vercelletto'
);

// 4. Three-word name
assert(
  formatPlayerName("John Jacob Smith", "JJ") === 'John "JJ" Jacob Smith',
  'John Jacob Smith + JJ -> John "JJ" Jacob Smith'
);

// 5. Single word name
assert(
  formatPlayerName("Milo", "The Legend") === 'Milo "The Legend"',
  'Milo + The Legend -> Milo "The Legend"'
);

// 6. No nickname
assert(
  formatPlayerName("Milo Vercelletto", null) === "Milo Vercelletto",
  'Milo Vercelletto + null -> Milo Vercelletto'
);

assert(
  formatPlayerName("Milo Vercelletto", "") === "Milo Vercelletto",
  'Milo Vercelletto + "" -> Milo Vercelletto'
);

assert(
  formatPlayerName("Milo Vercelletto", "   ") === "Milo Vercelletto",
  'Milo Vercelletto + "   " -> Milo Vercelletto'
);

console.log("\nAll nickname format tests passed successfully!");
