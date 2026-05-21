import fs from 'fs';
import path from 'path';
import postcss from 'postcss';
import prefixer from 'postcss-prefix-selector';

const dir = './src/admin';

function getFiles(dirPath) {
  let files = [];
  const items = fs.readdirSync(dirPath, { withFileTypes: true });
  for (const item of items) {
    const fullPath = path.join(dirPath, item.name);
    if (item.isDirectory()) {
      files = files.concat(getFiles(fullPath));
    } else if (fullPath.endsWith('.css')) {
      files.push(fullPath);
    }
  }
  return files;
}

const cssFiles = getFiles(dir);

const processor = postcss([
  prefixer({
    prefix: '.admin-root',
    transform: function (prefix, selector, prefixedSelector, filePath, rule) {
      if (selector === ':root' || selector === 'body' || selector === 'html') {
          // We don't prefix :root, but we should scope 'body' styles if they exist?
          // I already changed body to .admin-root in App.css manually.
          return selector;
      }
      if (selector === '.admin-root') return selector;
      if (selector.startsWith('.admin-root ')) return selector;
      
      if (selector.startsWith('[data-theme="dark"]')) {
        if (selector.includes('.admin-root')) return selector;
        return selector.replace('[data-theme="dark"]', '[data-theme="dark"] ' + prefix);
      }
      
      return prefix + ' ' + selector;
    }
  })
]);

async function processFiles() {
  for (const file of cssFiles) {
    const css = fs.readFileSync(file, 'utf8');
    const result = await processor.process(css, { from: file, to: file });
    fs.writeFileSync(file, result.css);
    console.log('Prefixed', file);
  }
}

processFiles().catch(console.error);
