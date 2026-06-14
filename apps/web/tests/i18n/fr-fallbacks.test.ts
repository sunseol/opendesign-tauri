import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { en } from '../../src/i18n/locales/en';
import { fr } from '../../src/i18n/locales/fr';
import type { Dict } from '../../src/i18n/types';

const FR_HOME_HERO_MEDIA_KEYS: ReadonlyArray<keyof Dict> = [
  'homeHero.chip.audio',
  'homeHero.chip.image',
  'homeHero.chip.prototype',
];

const FR_INTEGRATIONS_SURFACE_KEYS: ReadonlyArray<keyof Dict> = [
  'integrations.tabHint.useEverywhere',
];

const FR_MANUAL_EDIT_ACTION_KEYS: ReadonlyArray<keyof Dict> = [
  'manualEdit.deleteElement',
  'manualEdit.deleteElementConfirm',
  'manualEdit.focusSlides',
  'manualEdit.showPanels',
  'manualEdit.uploadImage',
  'manualEdit.uploadImageFailed',
  'manualEdit.uploadingImage',
];

const FR_PET_IDLE_QUOTE_TEXT_KEYS: ReadonlyArray<keyof Dict> = [
  'pet.idleQuote.bernini.text',
  'pet.idleQuote.caravaggio.text',
  'pet.idleQuote.leonardo.text',
  'pet.idleQuote.michelangelo.text',
  'pet.idleQuote.raphael.text',
  'pet.idleQuote.rodin.text',
];

const FR_PET_IDLE_QUOTE_AUTHOR_KEYS: ReadonlyArray<keyof Dict> = [
  'pet.idleQuote.bernini.author',
  'pet.idleQuote.caravaggio.author',
  'pet.idleQuote.leonardo.author',
  'pet.idleQuote.michelangelo.author',
  'pet.idleQuote.raphael.author',
  'pet.idleQuote.rodin.author',
];

const FR_PET_TASK_STATUS_KEYS: ReadonlyArray<keyof Dict> = [
  'pet.taskGroup.queued',
  'pet.taskGroup.recent',
  'pet.taskGroup.running',
  'pet.taskListAria',
  'pet.taskOpenProject',
  'pet.taskSummaryMultiple',
  'pet.taskSummaryRecentMultiple',
  'pet.taskSummaryRecentSingle',
  'pet.taskSummarySingle',
];

const FR_STABLE_PRODUCT_NAME_KEYS: ReadonlyArray<keyof Dict> = [
  'homeHero.chip.hyperframes',
  'integrations.tabLabel.mcp',
];

function explicitFrenchKeys(): Set<string> {
  const source = readFileSync(new URL('../../src/i18n/locales/fr.ts', import.meta.url), 'utf8');
  return new Set(Array.from(source.matchAll(/'([^']+)':/g), (match) => match[1] ?? ''));
}

describe('fr fallback parity', () => {
  it('keeps French home hero media chips translated instead of falling back to English', () => {
    for (const key of FR_HOME_HERO_MEDIA_KEYS) {
      expect(fr[key], `fr.${key}`).not.toBe(en[key]);
    }
  });

  it('keeps French integration surface hints translated instead of falling back to English', () => {
    for (const key of FR_INTEGRATIONS_SURFACE_KEYS) {
      expect(fr[key], `fr.${key}`).not.toBe(en[key]);
    }
  });

  it('keeps French manual edit actions translated instead of falling back to English', () => {
    for (const key of FR_MANUAL_EDIT_ACTION_KEYS) {
      expect(fr[key], `fr.${key}`).not.toBe(en[key]);
    }
  });

  it('keeps French pet idle quote text translated instead of falling back to English', () => {
    for (const key of FR_PET_IDLE_QUOTE_TEXT_KEYS) {
      expect(fr[key], `fr.${key}`).not.toBe(en[key]);
    }
  });

  it('declares French pet idle quote authors explicitly instead of relying on fallback', () => {
    const explicitKeys = explicitFrenchKeys();

    for (const key of FR_PET_IDLE_QUOTE_AUTHOR_KEYS) {
      expect(explicitKeys.has(key), `fr.${key}`).toBe(true);
      expect(fr[key], `fr.${key}`).not.toHaveLength(0);
    }
  });

  it('keeps French pet task status copy translated instead of falling back to English', () => {
    for (const key of FR_PET_TASK_STATUS_KEYS) {
      expect(fr[key], `fr.${key}`).not.toBe(en[key]);
    }
  });

  it('declares French stable product and acronym labels explicitly instead of relying on fallback', () => {
    const explicitKeys = explicitFrenchKeys();

    for (const key of FR_STABLE_PRODUCT_NAME_KEYS) {
      expect(explicitKeys.has(key), `fr.${key}`).toBe(true);
      expect(fr[key], `fr.${key}`).toBe(en[key]);
    }
  });
});
