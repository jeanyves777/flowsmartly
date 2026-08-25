export function resolve(specifier, context, next) {
  if (specifier === 'react-native') {
    return { url: new URL('./test-react-native-stub.mjs', import.meta.url).href, shortCircuit: true };
  }
  return next(specifier, context);
}
