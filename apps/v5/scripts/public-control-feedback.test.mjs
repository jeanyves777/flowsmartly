import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const source = readFileSync(new URL('../src/app/+html.tsx', import.meta.url), 'utf8');
const style = source.match(/const FONT_CSS = `([\s\S]*?)`;/)?.[1];

assert.ok(style, 'the public HTML shell must contain a closed FONT_CSS template');

const targets = [
  '[role="button"]',
  'a',
  'button',
  'input[type="button"]',
  'input[type="submit"]',
  'input[type="reset"]',
];

function ruleSelectorContaining(snippet) {
  const rule = style.split('}').find((part) => part.includes(snippet));
  assert.ok(rule, `expected a CSS rule containing ${snippet}`);
  return rule.slice(0, rule.indexOf('{')).trim();
}

test('enabled public controls share hover and pressed feedback', () => {
  for (const state of [':hover', ':active']) {
    const selector = ruleSelectorContaining(state);
    for (const target of targets) assert.ok(selector.includes(target), `${state} should include ${target}`);
    assert.match(selector, /:not\(:disabled\)/, 'native disabled controls are excluded');
    assert.match(selector, /:not\(\[disabled\]\)/, 'explicit disabled attributes are excluded');
    assert.match(selector, /:not\(\[aria-disabled="true"\]\)/, 'aria-disabled controls are excluded');
  }
});

test('keyboard focus remains visible and reduced motion removes movement', () => {
  const focus = ruleSelectorContaining(':focus-visible');
  for (const target of targets) assert.ok(focus.includes(target), `focus-visible should include ${target}`);
  assert.match(style.slice(style.indexOf(':focus-visible')), /outline: 3px solid #6d5efc/);

  const reduced = style.slice(style.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(reduced.startsWith('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /transition: none !important/);
  assert.match(reduced, /transform: none !important/);
  assert.match(reduced, /:not\(\[aria-disabled="true"\]\)/, 'reduced-motion rules keep the enabled-control boundary');
});
