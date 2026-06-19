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
          if (file.endsWith('.tsx') || file.endsWith('.ts')) {
            results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

const replacements = {
  'Khong ro thoi gian': 'Không rõ thời gian',
  'Khong ro': 'Không rõ',
  'Khong the tai don hang': 'Không thể tải đơn hàng',
  'Khong the tu choi don': 'Không thể từ chối đơn',
  'Khong the gui don': 'Không thể gửi đơn',
  'Khong the lay vi tri hien tai': 'Không thể lấy vị trí hiện tại',
  'Khong tim thay nha hang': 'Không tìm thấy nhà hàng',
  'Khong the tao don hang': 'Không thể tạo đơn hàng',
  'Khong the tai danh muc': 'Không thể tải danh mục',
  'Khong the luu danh muc': 'Không thể lưu danh mục',
  'Khong the xoa danh muc': 'Không thể xóa danh mục',
  'Khong the tai danh sach quan': 'Không thể tải danh sách quán',
  'Khong the tai chu quan': 'Không thể tải chủ quán',
  'Khong the luu quan': 'Không thể lưu quán',
  'Khong the xoa quan': 'Không thể xóa quán',
  'Khong the duyet quan': 'Không thể duyệt quán',
  'Khong the tu choi quan': 'Không thể từ chối quán',
  'Ch? xc nh?n': 'Chờ xác nhận',
  'Ch? xc nh?n': 'Chờ xác nhận',
  'Dang lam': 'Đang làm',
  'Hon thnh': 'Hoàn thành',
  'Hon thnh': 'Hoàn thành',
  'Đơn hàng quan': 'Đơn hàng quán',
  'xc nh?n don': 'xác nhận đơn',
  'Xc nh?n don': 'Xác nhận đơn',
  'Xac nhan don': 'Xác nhận đơn',
  'Đơn hàng gui toi quan': 'Đơn hàng gửi tới quán',
  'Quan ly thuc don o muc': 'Quản lý thực đơn ở mục',
  'Ban chua duoc gan quan nao. Lien he admin de tao quan.': 'Bạn chưa được gán quán nào. Liên hệ admin để tạo quán.',
  'Don hom nay': 'Đơn hôm nay',
  'Doanh thu hom nay': 'Doanh thu hôm nay',
  'Mon ban chay': 'Món bán chạy',
  'Mon sap het': 'Món sắp hết',
  'Tat ca': 'Tất cả',
  'Loc theo quan': 'Lọc theo quán',
  'Tat ca quan cua toi': 'Tất cả quán của tôi',
  'Loc theo trang thai': 'Lọc theo trạng thái',
  'Tat ca trang thai': 'Tất cả trạng thái',
  'Dang tai don hang...': 'Đang tải đơn hàng...',
  'Khach #': 'Khách #',
  'Theo doi': 'Theo dõi',
  'Tu choi don': 'Từ chối đơn',
  'Dang xac nhan...': 'Đang xác nhận...',
  'Da tu choi don': 'Đã từ chối đơn',
  'Dang xu ly...': 'Đang xử lý...',
  'Xc nh?n tu choi': 'Xác nhận từ chối',
  'Ly do tu choi': 'Lý do từ chối',
  'Vi du: quan het mon, khong phuc vu khu vuc nay...': 'Ví dụ: quán hết món, không phục vụ khu vực này...',
  'Khong the tai quan': 'Không thể tải quán',
  'Khong the tai Socket.io client': 'Không thể tải Socket.io client',
  'Thực đơn': 'Thực đơn',
  'Lam moi': 'Làm mới',
  ' xc nh?n don': 'Đã xác nhận đơn',
  'Khng th? xc nh?n don': 'Không thể xác nhận đơn'
};

walk(path.join(__dirname, 'client/fe_fegrapfood/src'), function(err, results) {
  if (err) throw err;
  let count = 0;
  results.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Some files might have the replacement char directly:
    // we should replace it but be careful not to corrupt anything else.
    // However, our dictionary approach replaces the whole string.

    for (const [key, value] of Object.entries(replacements)) {
      content = content.split(key).join(value);
    }
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      count++;
    }
  });
  console.log('Fixed unaccented strings in ' + count + ' files.');
});
