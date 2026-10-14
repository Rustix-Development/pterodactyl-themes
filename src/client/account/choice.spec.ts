// @vitest-environment node
import { describe, expect, test } from 'vitest';
import { fromSelectValue, PANEL_CHOICE, toSelectValue } from './choice.ts';

describe('preset picker values', () => {
    test("the panel's choice has a value the select shows", () => {
        expect(toSelectValue(null)).toBe(PANEL_CHOICE);
        expect(toSelectValue(undefined)).toBe(PANEL_CHOICE);
        expect(PANEL_CHOICE).not.toBe('');
    });

    test('a preset round-trips', () => {
        expect(toSelectValue(7)).toBe('7');
        expect(fromSelectValue('7')).toBe(7);
        expect(fromSelectValue(PANEL_CHOICE)).toBeNull();
    });
});
