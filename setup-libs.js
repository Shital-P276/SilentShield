// SilentShield — setup-libs.js v2
// Extracts transformers.min.js AND the matching WASM files from the SAME package.
// This guarantees zero version mismatch between JS and WASM.
// Run once from your SilentShield folder: node setup-libs.js

const https  = require('https');
const fs     = require('fs');
const path   = require('path');
const tar    = require('tar');
const os     = require('os');

const LIBS_DIR = path.join(__dirname, 'libs');
if (!fs.existsSync(LIBS_DIR)) fs.mkdirSync(LIBS_DIR);

const PKG_URL = 'https://registry.npmjs.org/@xenova/transformers/-/transformers-2.17.2.tgz';
const TMP_TGZ = path.join(os.tmpdir(), 'xenova-transformers-2.17.2.tgz');

// Files to extract from the package → filename in libs/
const EXTRACT_MAP = {
  'package/dist/transformers.min.js':         'transformers.min.js',
  'package/dist/ort-wasm.wasm':               'ort-wasm.wasm',
  'package/dist/ort-wasm-simd.wasm':          'ort-wasm-simd.wasm',
  'package/dist/ort-wasm-threaded.wasm':      'ort-wasm-threaded.wasm',
  'package/dist/ort-wasm-simd-threaded.wasm': 'ort-wasm-simd-threaded.wasm',
};

function download(url, dest) {
  return new Promise((resolve, reject) => {
    if (fs.existsSync(dest)) {
      console.log(`  ✓ Already cached: ${path.basename(dest)}`);
      return resolve();
    }
    console.log(`  ↓ Downloading package (~30MB, please wait)...`);
    const file = fs.createWriteStream(dest);
    const get = (u) => {
      https.get(u, (res) => {
        if (res.statusCode === 301 || res.statusCode === 302) return get(res.headers.location);
        if (res.statusCode !== 200) return reject(new Error(`HTTP ${res.statusCode}`));
        res.pipe(file);
        file.on('finish', () => { file.close(); resolve(); });
      }).on('error', reject);
    };
    get(url);
  });
}

async function extractFiles() {
  const needed = new Set(Object.keys(EXTRACT_MAP));

  await tar.t({
    file: TMP_TGZ,
    onentry: (entry) => {
      if (!needed.has(entry.path)) return;

      const destName = EXTRACT_MAP[entry.path];
      const outPath  = path.join(LIBS_DIR, destName);

      if (fs.existsSync(outPath)) {
        console.log(`  ✓ Already exists: ${destName}`);
        return;
      }

      const chunks = [];
      entry.on('data', c => chunks.push(c));
      entry.on('end', () => {
        const buf = Buffer.concat(chunks);
        fs.writeFileSync(outPath, buf);
        console.log(`  ✅ ${destName}  (${(buf.length / 1024 / 1024).toFixed(1)} MB)`);
      });
    }
  });
}

(async () => {
  console.log('SilentShield — setup-libs.js v2\n');
  console.log('Extracting WASM files directly from @xenova/transformers@2.17.2');
  console.log('(JS and WASM come from the same package = no CompileError)\n');

  try {
    await download(PKG_URL, TMP_TGZ);
    console.log('\n  Extracting...');
    await extractFiles();

    console.log('\n✅ Done! libs/ contents:');
    for (const f of fs.readdirSync(LIBS_DIR)) {
      const mb = (fs.statSync(path.join(LIBS_DIR, f)).size / 1024 / 1024).toFixed(1);
      console.log(`   ${f.padEnd(40)} ${mb} MB`);
    }
    console.log('\nNext: reload the extension in edge://extensions/ then refresh Reddit.');
  } catch (err) {
    console.error('\n✗ Failed:', err.message);
    console.error('\nAlternative — if you already ran npm install @xenova/transformers, just copy manually:');
    console.error('  cp node_modules/@xenova/transformers/dist/transformers.min.js libs/');
    console.error('  cp node_modules/@xenova/transformers/dist/*.wasm libs/');
  }
})();
