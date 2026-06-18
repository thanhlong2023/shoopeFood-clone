const fs = require('fs');
const file = 'src/pages/TrackingPage.tsx';

let content = fs.readFileSync(file, 'utf8');

// Fix the missing quotes caused by greedy regex
content = content.replace(/'Không thể gửi đánh giá\n/g, "'Không thể gửi đánh giá')\n");
content = content.replace(/'Gửi đánh giá\n/g, "'Gửi đánh giá'}\n");
content = content.replace(/'Không thể gửi đánh giá\r\n/g, "'Không thể gửi đánh giá')\r\n");
content = content.replace(/'Gửi đánh giá\r\n/g, "'Gửi đánh giá'}\r\n");

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed quotes');
