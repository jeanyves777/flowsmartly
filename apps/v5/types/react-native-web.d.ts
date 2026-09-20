/**
 * Style properties `react-native-web` supports that React Native's own types
 * do not declare.
 *
 * RNW compiles a `View` style straight to CSS, so a handful of web-only
 * properties work at runtime while `ViewStyle` — written for native — has never
 * heard of them. `backdropFilter` is the one the frosted glass on the home hero
 * needs: without it the tint has to be heavy enough to carry text on its own
 * and the panel stops being see-through.
 *
 * Declaring it here rather than casting keeps it **typed as a string**. A cast
 * would hide the property from the compiler entirely, and `as any` would hide
 * everything else in the same object with it.
 *
 * It is inert on native: React Native ignores style keys it does not implement,
 * so an iOS or Android build renders the panel without the blur rather than
 * failing. Anything added here must be safe under that rule.
 */
import 'react-native';

declare module 'react-native/Libraries/StyleSheet/StyleSheetTypes' {
  interface ViewStyle {
    /** web only — RNW emits this as the CSS `backdrop-filter` property */
    backdropFilter?: string;
  }
}
