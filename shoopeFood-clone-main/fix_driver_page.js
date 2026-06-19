const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'client/fe_fegrapfood/src/pages/DriverPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const replacements = {
  'Chua c l? trnh': 'Chưa có lộ trình',
  'Ti x?': 'Tài xế',
  'Khong the tai tracking': 'Không thể tải tracking',
  'Khng th? t?i b?ng ti x?': 'Không thể tải bảng tài xế',
  'Trnh duy?t khng h? tr? GPS, dng v? tr cu?i cng n?u c.': 'Trình duyệt không hỗ trợ GPS, dùng vị trí cuối cùng nếu có.',
  'GPS dang c?p nh?t': 'GPS đang cập nhật',
  'Khng th? g?i v? tr': 'Không thể gửi vị trí',
  'Chua du?c c?p quy?n GPS, dng v? tr cu?i cng trn h? th?ng.': 'Chưa được cấp quyền GPS, dùng vị trí cuối cùng trên hệ thống.',
  'B?n dang c don dang giao. Hon thnh don hi?n t?i tru?c khi nh?n don m?i.': 'Bạn đang có đơn đang giao. Hoàn thành đơn hiện tại trước khi nhận đơn mới.',
  'Da nhan don': 'Đã nhận đơn',
  'Khng th? nh?n don': 'Không thể nhận đơn',
  'Da cap nhat': 'Đã cập nhật',
  'Khng th? c?p nh?t tr?ng thi': 'Không thể cập nhật trạng thái',
  'Quan #': 'Quán #',
  'Don #': 'Đơn #',
  'ang giao don khc': 'Đang giao đơn khác',
  'Nh?n don': 'Nhận đơn',
  'on hng quanh b?n': 'Đơn hàng quanh bạn',
  'Dang tai...': 'Đang tải...',
  'don da xac nhan': 'đơn đã xác nhận',
  'don trong': 'đơn trong',
  'T?i l?i don': 'Tải lại đơn',
  'on m?i d xc nh?n': 'Đơn mới đã xác nhận',
  'on m?i g?n b?n': 'Đơn mới gần bạn',
  'Chua c don CONFIRMED no. Hy ch? merchant xc nh?n don tru?c.': 'Chưa có đơn CONFIRMED nào. Hãy chờ merchant xác nhận đơn trước.',
  'on c?a ti': 'Đơn của tôi',
  'B?n chua nh?n don no.': 'Bạn chưa nhận đơn nào.',
  'on dang ch?n': 'Đơn đang chọn',
  'Ch?n don d? xem chi ti?t': 'Chọn đơn để xem chi tiết',
  'Nh hng': 'Nhà hàng',
  'Khch hng': 'Khách hàng',
  'ST khch': 'SĐT khách',
  'Ti?n c?n thu': 'Tiền cần thu',
  'Qung du?ng': 'Quãng đường',
  '?n nh hng': 'Đến nhà hàng',
  ' l?y mn': 'Đã lấy món',
  'Hon thnh': 'Hoàn thành',
  'H?y don': 'Hủy đơn',
  'Chua c route OSRM cho don ny.': 'Chưa có route OSRM cho đơn này.',
  'Ha don': 'Hóa đơn',
  'Mn c?n l?y': 'Món cần lấy',
  'VND / mon': 'VND / món',
  'on ny chua c chi ti?t mn trong d? li?u tr? v?.': 'Đơn này chưa có chi tiết món trong dữ liệu trả về.',
  'Ti?n mn': 'Tiền món',
  'Ph giao hng': 'Phí giao hàng',
  'Thu?': 'Thuế',
  'Gi?m gi': 'Giảm giá',
  'T?ng don': 'Tổng đơn',
  'Ti x? thu': 'Tài xế thu',
  'Khng c don dang ch?n.': 'Không có đơn đang chọn.',
  'Chua co don moi trong ban kinh': 'Chưa có đơn mới trong bán kính',
  'Neu can demo, kiem tra toa do nha hang va vi tri tai xe.': 'Nếu cần demo, kiểm tra tọa độ nhà hàng và vị trí tài xế.'
};

let originalContent = content;

for (const [broken, fixed] of Object.entries(replacements)) {
  content = content.split(broken).join(fixed);
}

if (content !== originalContent) {
  fs.writeFileSync(filePath, content, 'utf8');
  console.log('Fixed DriverPage.tsx');
} else {
  console.log('No changes made');
}
