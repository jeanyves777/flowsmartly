// `tokens.ts` imports `Platform` from react-native so `elevation()` can pick a
// web boxShadow or a native shadow. Node cannot load the real module (Flow
// syntax), and the palettes under test do not depend on it — so the module is
// stubbed for the test run rather than the tokens being split into a second
// file to make them importable. Colours live in exactly one place.
import { register } from 'node:module';
register('./test-resolve.mjs', import.meta.url);
