import { safeNext } from './safeRedirect';

describe('safeNext', () => {
  test('keeps paths inside the app, including query and hash', () => {
    expect(safeNext('/messages')).toBe('/messages');
    expect(safeNext('/search?q=a%20b&x=1#top')).toBe('/search?q=a%20b&x=1#top');
    expect(safeNext('/')).toBe('/');
  });

  test('refuses other sites however they are written', () => {
    for (const bad of [
      'https://evil.example', 'http://evil.example/x', '//evil.example', '///evil.example',
      '/\\evil.example', '\\\\evil.example', 'javascript:alert(1)', 'data:text/html,hi',
      'evil.example', '/%2F%2Fevil.example/../..//evil.example'.replace('%2F', '/'),
      '/\t/evil.example', '/\n/evil.example', ' //evil.example',
    ]) {
      expect(safeNext(bad)).toBe('/');
    }
  });

  test('refuses missing, empty, non-string and huge values', () => {
    expect(safeNext(null)).toBe('/');
    expect(safeNext(undefined)).toBe('/');
    expect(safeNext('')).toBe('/');
    expect(safeNext(42)).toBe('/');
    expect(safeNext('/' + 'a'.repeat(3000))).toBe('/');
  });

  test('uses the fallback when given one', () => {
    expect(safeNext('https://evil.example', '/messages')).toBe('/messages');
  });
});
