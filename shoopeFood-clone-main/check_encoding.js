const fs = require('fs');
const path = require('path');

function walk(dir, done) {
  let results = [];
  fs.readdir(dir, function(err, list) {
    if (err) return done(err);
    let pending = list.length;
    if (!pending) return done(null, results);
    list.forEach(function(file) {
      file = path.resolve(dir, file);
      fs.stat(file, function(err, stat) {
        if (stat && stat.isDirectory()) {
          walk(file, function(err, res) {
            results = results.concat(res);
            if (!--pending) done(null, results);
          });
        } else {
          if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js') || file.endsWith('.java') || file.endsWith('.xml')) {
            results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

function checkFiles(directories) {
  let allResults = [];
  let pending = directories.length;
  
  directories.forEach(dir => {
    walk(dir, (err, res) => {
      if (res) allResults = allResults.concat(res);
      if (!--pending) {
        let badFiles = [];
        allResults.forEach(file => {
          try {
            const content = fs.readFileSync(file, 'utf8');
            // Check for replacement character
            if (content.includes('\ufffd')) {
              badFiles.push({ file, type: 'replacement_char' });
            }
            // Check for weird encoding patterns like 'NhA hAng', '?n hAng', 'Qun lA'
            // We'll just look for some common ones from the fix_encoding.js
            else if (content.match(/NhA hAng|\?n hAng|Qun lA|mA3n|d_ liu|khA'ng|tAi khon|Cha cA3|`n hAng|Trng thAi|Thc `n/g)) {
              badFiles.push({ file, type: 'garbled_vietnamese' });
            }
          } catch(e) {}
        });
        console.log(JSON.stringify(badFiles, null, 2));
      }
    });
  });
}

checkFiles([
  path.join(__dirname, 'client'),
  path.join(__dirname, 'Mobile'),
  path.join(__dirname, 'server')
]);
