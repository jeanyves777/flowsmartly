import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';

const login = readFileSync(new URL('../src/app/login.tsx', import.meta.url), 'utf8');

test('marketing /login fallback does not automatically reload its own URL', () => {
  assert.doesNotMatch(login, /\buseEffect\s*\(/u);
  assert.doesNotMatch(login, /\bgoToLogin\s*\(/u);
});

test('fallback gives an explicit V5-only login retry, not a sign-in form', () => {
  assert.match(login, /onPress=\{goToLogin\}/u);
  assert.match(login, /FlowSmartly V5 portal/u);
  assert.match(login, /accessibilityRole="link"/u);
  assert.doesNotMatch(login, /legacy\.flowsmartly\.com|<TextInput/u);
});
