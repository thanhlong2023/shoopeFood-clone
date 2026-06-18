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
  let count = 0;
  results.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;

    // We look for patterns like foodPhotoStyle(food.imageUrl) and replace with foodPhotoStyle(food.imageUrl, food.id)
    // Regex explanation:
    // match: foodPhotoStyle( SOME_OBJ .imageUrl )
    // replace: foodPhotoStyle( SOME_OBJ.imageUrl, SOME_OBJ.id )
    
    // Note: Some might be getRestaurantImageUrl(imageUrls[restaurant.id]) or similar, so we only target the simple ones.
    
    content = content.replace(/foodPhotoStyle\(\s*([\w\.]+)\.imageUrl\s*\)/g, 'foodPhotoStyle($1.imageUrl, $1.id)');
    content = content.replace(/restaurantThumbStyle\(\s*([\w\.]+)\.imageUrl\s*\)/g, 'restaurantThumbStyle($1.imageUrl, $1.id)');
    content = content.replace(/restaurantCoverStyle\(\s*([\w\.]+)\.imageUrl\s*\)/g, 'restaurantCoverStyle($1.imageUrl, $1.id)');

    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      count++;
    }
  });
  console.log('Updated ' + count + ' TSX files.');
});
