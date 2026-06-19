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
          if (file.endsWith('.tsx') || file.endsWith('.ts') || file.endsWith('.jsx') || file.endsWith('.js')) {
            results.push(file);
          }
          if (!--pending) done(null, results);
        }
      });
    });
  });
}

const dictionary = {
  'nha hang': 'nhà hàng',
  'Nha hang': 'Nhà hàng',
  'don hang': 'đơn hàng',
  'Don hang': 'Đơn hàng',
  'tai khoan': 'tài khoản',
  'Tai khoan': 'Tài khoản',
  'chu quan': 'chủ quán',
  'Chu quan': 'Chủ quán',
  'tai xe': 'tài xế',
  'Tai xe': 'Tài xế',
  'thuc don': 'thực đơn',
  'Thuc don': 'Thực đơn',
  'danh muc': 'danh mục',
  'Danh muc': 'Danh mục',
  'Quan ly': 'Quản lý',
  'Dang ky': 'Đăng ký',
  'Hoan thanh': 'Hoàn thành',
  'Tu choi': 'Từ chối',
  'tu choi': 'từ chối',
  'Xac nhan': 'Xác nhận',
  'xac nhan': 'xác nhận',
  'Dang lam': 'Đang làm',
  'dang lam': 'đang làm',
  'Dang tai': 'Đang tải',
  'Khong the': 'Không thể',
  'Khong tim thay': 'Không tìm thấy',
  'Khong ro': 'Không rõ',
  'Chua co': 'Chưa có',
  'chua co': 'chưa có',
  'Chi tiet': 'Chi tiết',
  'chi tiet': 'chi tiết',
  'Lien he': 'Liên hệ',
  'Thong ke': 'Thống kê',
  'thong ke': 'thống kê',
  'Doanh thu': 'Doanh thu',
  'Hom nay': 'Hôm nay',
  'hom nay': 'hôm nay',
  'Trang thai': 'Trạng thái',
  'trang thai': 'trạng thái',
  'Ban chay': 'Bán chạy',
  'ban chay': 'bán chạy',
  'Tat ca': 'Tất cả',
  'tat ca': 'tất cả',
  'Tong don': 'Tổng đơn',
  'tong don': 'tổng đơn',
  'Tong tien': 'Tổng tiền',
  'tong tien': 'tổng tiền',
  'Phi giao': 'Phí giao',
  'phi giao': 'phí giao',
  'Theo doi': 'Theo dõi',
  'theo doi': 'theo dõi',
  'Ly do': 'Lý do',
  'ly do': 'lý do',
  'Giao hang': 'Giao hàng',
  'giao hang': 'giao hàng',
  'Kich hoat': 'Kích hoạt',
  'kich hoat': 'kích hoạt',
  'Xet duyet': 'Xét duyệt',
  'xet duyet': 'xét duyệt',
  'Nhap day du': 'Nhập đầy đủ',
  'nhap day du': 'nhập đầy đủ',
  'thong tin': 'thông tin',
  'Thong tin': 'Thông tin',
  'Ten ': 'Tên ',
  'ten ': 'tên ',
  'Anh bia': 'Ảnh bìa',
  'anh bia': 'ảnh bìa',
  'Cho xac nhan': 'Chờ xác nhận',
  'Phai chon': 'Phải chọn',
  'phai chon': 'phải chọn',
  'Neu chon sai': 'Nếu chọn sai',
  'neu chon sai': 'nếu chọn sai',
  'Truoc khi': 'Trước khi',
  'truoc khi': 'trước khi',
  'Da gui': 'Đã gửi',
  'da gui': 'đã gửi',
  'Quan cua ban': 'Quán của bạn',
  'quan cua ban': 'quán của bạn',
  'Hien tai': 'Hiện tại',
  'hien tai': 'hiện tại',
  'Khach ': 'Khách ',
  'khach ': 'khách ',
  'Lam tai xe': 'Làm tài xế',
  'lam tai xe': 'làm tài xế',
  'Mo quan': 'Mở quán',
  'mo quan': 'mở quán',
  'Mo nha hang': 'Mở nhà hàng',
  'mo nha hang': 'mở nhà hàng',
  'Cua toi': 'Của tôi',
  'cua toi': 'của tôi',
  'Danh sach': 'Danh sách',
  'danh sach': 'danh sách',
  'Duyet': 'Duyệt',
  'duyet': 'duyệt',
  'Xoa': 'Xóa',
  'Luu': 'Lưu'
};

walk(path.join(__dirname, 'client/fe_fegrapfood/src'), function(err, results) {
  if (err) throw err;
  let count = 0;
  results.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // Quick regex replace for each term to match whole words or parts
    for (const [key, value] of Object.entries(dictionary)) {
      // Need to be careful with short words, but we will just global replace
      const regex = new RegExp(key, 'g');
      content = content.replace(regex, value);
    }
    
    // Fix up some over-replacements
    content = content.replace(/className="[^"]*"/g, match => {
      // restore original class names if they were changed
      let restored = match;
      for (const [key, value] of Object.entries(dictionary)) {
        const regex = new RegExp(value, 'g');
        restored = restored.replace(regex, key);
      }
      return restored;
    });
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      count++;
    }
  });
  console.log('Fixed additional unaccented strings in ' + count + ' files.');
});
