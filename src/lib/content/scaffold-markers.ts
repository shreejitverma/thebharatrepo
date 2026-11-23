export const SCAFFOLD_TODO = 'TODO(scaffold):';
export const SCAFFOLD_SOURCE = 'src.todo-scaffold-replace-me';
export const SCAFFOLD_URL = 'https://todo-scaffold.invalid/';

export function unfinishedFields(value: unknown, field = ''): string[] {
  if (typeof value === 'string') {
    if (value.startsWith(SCAFFOLD_TODO)) return [`${field}: ${value.slice(SCAFFOLD_TODO.length).trim()}`];
    if (value === SCAFFOLD_SOURCE) return [`${field}: replace the placeholder with a real src.<slug> citation`];
    if (value === SCAFFOLD_URL) return [`${field}: replace the placeholder with a verifiable URL, DOI, ISBN or OCLC number`];
  }
  if (Array.isArray(value)) return value.flatMap((item, i) => unfinishedFields(item, `${field}[${i}]`));
  if (value && typeof value === 'object') {
    return Object.entries(value).flatMap(([key, item]) => unfinishedFields(item, field ? `${field}.${key}` : key));
  }
  return [];
}
