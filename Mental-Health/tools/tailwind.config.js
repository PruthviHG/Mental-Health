// Builds assets/css/tailwind.css (replaces the Tailwind CDN runtime). Run: npm run build:css
module.exports = {
  content: ['./index.html', './performance.html', './js/**/*.js'],
  theme: { extend: {} },
  corePlugins: {},
};
