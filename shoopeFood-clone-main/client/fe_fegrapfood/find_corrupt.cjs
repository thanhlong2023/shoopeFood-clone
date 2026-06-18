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
          if (file.endsWith('.tsx') || file.endsWith('.ts')) results.push(file);
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

walk('./src', function(err, results) {
  if (err) throw err;
  let corruptFiles = [];
  results.forEach(file => {
    const content = fs.readFileSync(file, 'utf8');
    // Look for suspicious encoding anomalies: '?' surrounded by letters or odd chars like 'dY'
    if (content.includes('?t l') || content.includes('dY') || content.includes('Khong co don') || content.includes('?ng k')) {
      corruptFiles.push(file);
    }
  });
  console.log(JSON.stringify(corruptFiles));
});
