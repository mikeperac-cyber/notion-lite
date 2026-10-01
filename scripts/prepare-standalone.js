const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

function copyDir(src, dest) {
  if (!fs.existsSync(src)) return;
  fs.mkdirSync(dest, { recursive: true });
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

const root = path.join(__dirname, '..');
const standalonePath = path.join(root, '.next', 'standalone');

if (fs.existsSync(standalonePath)) {
  console.log('Copying static assets and Prisma binaries to standalone bundle...');
  copyDir(path.join(root, 'public'), path.join(standalonePath, 'public'));
  copyDir(path.join(root, '.next', 'static'), path.join(standalonePath, '.next', 'static'));
  const templateDir = path.join(standalonePath, 'prisma');
  fs.mkdirSync(templateDir, { recursive: true });
  fs.copyFileSync(path.join(root, 'prisma', 'schema.prisma'), path.join(templateDir, 'schema.prisma'));
  const templateDb = path.join(templateDir, 'template.db');
  const scratchDb = path.join(root, 'prisma', 'template.db');
  if (fs.existsSync(templateDb)) fs.unlinkSync(templateDb);
  if (fs.existsSync(scratchDb)) fs.unlinkSync(scratchDb);
  fs.writeFileSync(scratchDb, Buffer.alloc(0));
  execFileSync(process.execPath, [path.join(root, 'node_modules', 'prisma', 'build', 'index.js'), 'db', 'push', '--skip-generate', '--schema', path.join(root, 'prisma', 'schema.prisma')], {
    cwd: root, stdio: 'inherit', env: { ...process.env, DATABASE_URL: 'file:./template.db' }
  });
  fs.copyFileSync(scratchDb, templateDb);
  fs.unlinkSync(scratchDb);
  
  // Explicitly copy generated Prisma client and engine binaries
  copyDir(path.join(root, 'node_modules', '.prisma'), path.join(standalonePath, 'node_modules', '.prisma'));
  copyDir(path.join(root, 'node_modules', '@prisma'), path.join(standalonePath, 'node_modules', '@prisma'));
  console.log('Standalone bundle prepared successfully.');
}
