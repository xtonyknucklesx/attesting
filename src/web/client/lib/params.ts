/**
 * Substitutes organization-defined parameter values into control description text.
 *
 * The description contains placeholders like `[organization-defined frequency]`
 * (resolved from OSCAL `{{ insert: param, ... }}` during import).
 *
 * When a param value is set by the user (e.g., "quarterly"), this function replaces
 * `[organization-defined frequency]` with `quarterly` (styled as bold).
 *
 * Also handles any remaining raw OSCAL markup `{{ insert: param, ... }}` as fallback.
 */
export function substituteParams(
  text: string,
  params: Array<{ param_id: string; label?: string; value?: string | null }> | null
): string {
  if (!text) return text;
  let result = text;

  if (params) {
    for (const p of params) {
      if (!p.value) continue;

      // Replace [label] with the set value
      if (p.label) {
        const escaped = p.label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        result = result.replace(new RegExp(`\\[${escaped}\\]`, 'gi'), p.value);
      }

      // Also replace raw OSCAL placeholder if still present
      const escapedId = p.param_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      result = result.replace(
        new RegExp(`\\{\\{\\s*insert:\\s*param,\\s*${escapedId}\\s*\\}\\}`, 'g'),
        p.value
      );
    }
  }

  // Fallback: clean any remaining raw OSCAL markup
  result = result.replace(/\{\{\s*insert:\s*param,\s*([^}\s]+)\s*\}\}/g, (_m, id: string) => {
    const readable = id.replace(/_odp\.\d+$/, '').replace(/_/g, ' ').replace(/^[a-z]+-\d+\s*/, '');
    return `[${readable || 'organization-defined parameter'}]`;
  });

  return result;
}
