// Production build without inline scripts, so the Content-Security-Policy can use script-src 'self'.
// (Setting the variable here, instead of in the npm script, keeps `npm run build` working on Windows.)
process.env.INLINE_RUNTIME_CHUNK = 'false';
require('react-scripts/scripts/build');
