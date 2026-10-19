/**
 * Formats a player's display name with an optional nickname.
 * Places the nickname in double quotes between the first name and last name:
 * e.g., 'Milo Vercelletto' + 'The Chosen One' -> 'Milo "The Chosen One" Vercelletto'
 * If the player only has a single name, it appends the nickname:
 * e.g., 'Milo' + 'The Chosen One' -> 'Milo "The Chosen One"'
 * If no nickname is set, returns the original displayName.
 */
export function formatPlayerName(displayName?: string | null, nickname?: string | null): string {
  if (!displayName) return "";
  if (!nickname || !nickname.trim()) return displayName;

  // Strip accidental outer quotes if user input included them
  const cleanNick = nickname.trim().replace(/^["“'”]+|["“'”]+$/g, "").trim();
  if (!cleanNick) return displayName;

  const parts = displayName.trim().split(/\s+/);
  if (parts.length <= 1) {
    return `${parts[0]} "${cleanNick}"`;
  }

  const firstName = parts[0];
  const rest = parts.slice(1).join(" ");
  return `${firstName} "${cleanNick}" ${rest}`;
}
