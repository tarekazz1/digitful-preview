import fs from 'node:fs';
import path from 'node:path';

const distDir = path.resolve(process.argv[2] || 'site/dist');

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const fullPath = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(fullPath) : [fullPath];
  });
}

if (!fs.existsSync(distDir)) {
  throw new Error(`Preview build directory not found: ${distDir}`);
}

const htmlFiles = walk(distDir).filter((file) => file.endsWith('.html'));
const robotsMeta = '<meta name="robots" content="noindex,nofollow,noarchive" />';
const formGuard = `<script>
document.addEventListener('submit', function (event) {
  const form = event.target;
  if (form instanceof HTMLFormElement && form.action.includes('formsubmit.co')) {
    event.preventDefault();
    alert('Preview site: form submission is disabled.');
  }
});
</script>`;

for (const file of htmlFiles) {
  let html = fs.readFileSync(file, 'utf8');

  // Keep preview traffic out of the production GTM/GA measurement stream.
  // Process one script block at a time so unrelated inline scripts (such as
  // the theme switcher) are never removed simply because GTM appears later.
  html = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, (scriptBlock) =>
    scriptBlock.includes('GTM-53THDCJH') ? '' : scriptBlock
  );
  html = html.replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, (noscriptBlock) =>
    noscriptBlock.includes('GTM-53THDCJH') ? '' : noscriptBlock
  );

  if (!html.includes('name="robots"')) {
    html = html.replace('</head>', `  ${robotsMeta}\n</head>`);
  }

  if (!html.includes('Preview site: form submission is disabled.')) {
    html = html.replace('</body>', `${formGuard}\n</body>`);
  }

  fs.writeFileSync(file, html);
}

fs.writeFileSync(path.join(distDir, 'robots.txt'), 'User-agent: *\nDisallow: /\n');
fs.writeFileSync(path.join(distDir, 'CNAME'), 'preview.digitful.ca\n');

console.log(`Prepared ${htmlFiles.length} HTML files for preview deployment.`);
