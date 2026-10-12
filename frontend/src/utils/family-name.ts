/** Keep an existing Family suffix; add it once to a bare family name. */
export function formatFamilyName(value: string): string {
  const name = value.trim();
  if (!name || /\bfamily$/i.test(name)) return name;
  return `${name}'s Family`;
}
