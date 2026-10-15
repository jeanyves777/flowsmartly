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

function selectorForDeclaration(declaration) {
  const rules = [...style.matchAll(/([^{}]+)\{\s*([^{}]+)\s*\}/g)];
  const rule = rules.find(([, , body]) => body.includes(declaration));
  assert.ok(rule, `expected a CSS declaration containing ${declaration}`);
  return rule[1].trim();
}

test('enabled public controls share hover and pressed feedback', () => {
  for (const state of [':hover', ':active']) {
    const selector = selectorForDeclaration(state === ':hover' ? 'translateY(-2px)' : 'translateY(1px) scale(0.985)');
    for (const target of targets) assert.ok(selector.includes(target), `${state} should include ${target}`);
    assert.match(selector, /:not\(:disabled\)/, 'native disabled controls are excluded');
    assert.match(selector, /:not\(\[disabled\]\)/, 'explicit disabled attributes are excluded');
    assert.match(selector, /:not\(\[aria-disabled="true"\]\)/, 'aria-disabled controls are excluded');
  }
});

test('keyboard focus remains visible and reduced motion removes movement', () => {
  const focus = selectorForDeclaration('outline: 3px solid #6d5efc');
  assert.ok(focus.startsWith(':where(#root, [role="dialog"])'), 'focus coverage reaches nested RN-web modal portals');
  for (const target of targets) assert.ok(focus.includes(target), `focus-visible should include ${target}`);
  for (const target of ['[role="link"]', '[role="tab"]', '[role="checkbox"]', 'input:not([type="hidden"])', 'textarea', 'select', '[tabindex]:not([tabindex="-1"])']) {
    assert.ok(focus.includes(target), `focus-visible should include RN-web/native target ${target}`);
  }
  assert.match(style.slice(style.indexOf(':focus-visible')), /outline: 3px solid #6d5efc/);

  const reduced = style.slice(style.indexOf('@media (prefers-reduced-motion: reduce)'));
  assert.ok(reduced.startsWith('@media (prefers-reduced-motion: reduce)'));
  assert.match(reduced, /transition: none !important/);
  assert.match(reduced, /transform: none !important/);
  assert.match(reduced, /:not\(\[aria-disabled="true"\]\)/, 'reduced-motion rules keep the enabled-control boundary');
});
