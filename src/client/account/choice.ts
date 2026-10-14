/** The select treats 0 as empty, so "the panel's choice" gets a string value of its own. */
export const PANEL_CHOICE = 'panel';

/** The select's value for a user's saved pick: a preset id, or none for the panel's choice. */
export function toSelectValue(choice: number | null | undefined): string {
    return choice == null ? PANEL_CHOICE : String(choice);
}

/** The pick to save for a select value. */
export function fromSelectValue(value: string | number): number | null {
    return value === PANEL_CHOICE ? null : Number(value);
}
