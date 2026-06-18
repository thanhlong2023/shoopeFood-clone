const fs = require('fs');

const fixLinks = () => {
  const files = [
    'src/pages/TrackingPage.tsx',
    'src/pages/BrowseRestaurantsPage.tsx'
  ];

  files.forEach(file => {
    if (!fs.existsSync(file)) return;
    let content = fs.readFileSync(file, 'utf8');
    content = content.replace(/to="\/"/g, 'to="/food"');
    fs.writeFileSync(file, content, 'utf8');
  });
  console.log('Fixed links.');
};

fixLinks();
