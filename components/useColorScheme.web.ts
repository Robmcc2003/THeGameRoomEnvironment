// I provide a web fallback for useColorScheme; on web I return 'light' to avoid server/client style mismatch (React Native does not support media queries here).
export function useColorScheme() {
  return 'light';
}
