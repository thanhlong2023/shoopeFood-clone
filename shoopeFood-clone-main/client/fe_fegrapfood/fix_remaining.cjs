const fs = require('fs');
const file = 'src/pages/TrackingPage.tsx';

let content = fs.readFileSync(file, 'utf8');

const mapping = [
  ["{isSubmittingReview ? 'Đang gửi...' : 'Gửi đánh giá\n", "{isSubmittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}\n"],
  ["{isSubmittingReview ? '\uFFFDĐang gửi...' : 'Gửi đánh giá\n", "{isSubmittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}\n"],
  ["{isSubmittingReview ? 'Đang gửi...' : 'Gửi đánh giá\r\n", "{isSubmittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}\r\n"],
  ["{isSubmittingReview ? '\uFFFDĐang gửi...' : 'Gửi đánh giá\r\n", "{isSubmittingReview ? 'Đang gửi...' : 'Gửi đánh giá'}\r\n"],
  ["'Không thể gửi đánh giá\n", "'Không thể gửi đánh giá')\n"],
  ["'Không thể gửi đánh giá\r\n", "'Không thể gửi đánh giá')\r\n"],
  ["<h2>\uFFFDĐơn đã đặt</h2>", "<h2>Đơn đã đặt</h2>"],
  ["{customerOrders.length} don \u00B7 {deliveringOrders.length} đang xử lý", "{customerOrders.length} đơn \u00B7 {deliveringOrders.length} đang xử lý"],
  ["{ordersLoading ? '\uFFFDĐang tải...' : 'Tai lai'}", "{ordersLoading ? 'Đang tải...' : 'Tải lại'}"],
  ["\u2190 Tru?c", "\u2190 Trước"],
  ["Ti?p \u2192", "Tiếp \u2192"],
  ["{isSelected ? '\uFFFDang xem' : 'Xem chi tiết \u2192'}", "{isSelected ? 'Đang xem' : 'Xem chi tiết \u2192'}"],
  ["{isSelected ? 'ang xem' : 'Xem chi tiết \u2192'}", "{isSelected ? 'Đang xem' : 'Xem chi tiết \u2192'}"]
];

for (const [search, replace] of mapping) {
  content = content.replace(search, replace);
}

// Global replace of the replacement character just to be safe
content = content.replace(new RegExp('\uFFFD', 'g'), '');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed remaining corruptions');
