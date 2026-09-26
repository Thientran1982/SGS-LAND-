import { describe, expect, it } from 'vitest';
import { uniqueSequenceName } from '../../utils/sequenceNames';

describe('uniqueSequenceName', () => {
    it('keeps a free name as is (trimmed)', () => {
        expect(uniqueSequenceName('  Chào mừng lead mới ', ['Nuôi dưỡng'])).toBe('Chào mừng lead mới');
    });

    it('adds the next free number, ignoring case and spaces', () => {
        const taken = ['Chào mừng lead mới', 'chào mừng lead mới (2) ', null];
        expect(uniqueSequenceName('Chào mừng lead mới', taken)).toBe('Chào mừng lead mới (3)');
    });

    it('numbers copies of a copy', () => {
        expect(uniqueSequenceName('Tái kích hoạt (bản sao)', ['Tái kích hoạt (bản sao)'])).toBe('Tái kích hoạt (bản sao) (2)');
    });
});
