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

const dict = {
  'Quan ly menu theo nha hang': 'Quản lý menu theo nhà hàng',
  'loc danh muc va mon an.': 'lọc danh mục và món ăn.',
  'Don hang': 'Đơn hàng',
  'Nha hang': 'Nhà hàng',
  'Quan ly menu': 'Quản lý menu',
  'gia va so luong mon moi ngay.': 'giá và số lượng món mỗi ngày.',
  'Quan ly tai xe': 'Quản lý tài xế',
  'bien so va trang thai online.': 'biển số và trạng thái online.',
  'Quan ly tai khoan khach hang va nhan su.': 'Quản lý tài khoản khách hàng và nhân sự.',
  'Chua co du lieu.': 'Chưa có dữ liệu.',
  'Chua co danh muc': 'Chưa có danh mục',
  'dang dang nhap voi role': 'đang đăng nhập với role',
  'Quan ly du lieu he thong.': 'Quản lý dữ liệu hệ thống.',
  'Quan ly thuc don online': 'Quản lý thực đơn online',
  'Chua co link anh': 'Chưa có link ảnh',
  'Chua co quan nao.': 'Chưa có quán nào.',
  'Chua co chu quan.': 'Chưa có chủ quán.',
  'Tao tai tab': 'Tạo tại tab',
  'Nguoi dung': 'Người dùng',
  'hoac dang nhap lai': 'hoặc đăng nhập lại',
  'Chua co danh muc phu hop.': 'Chưa có danh mục phù hợp.',
  'Chua co quan nao duoc gan.': 'Chưa có quán nào được gán.',
  'Lien he admin de duoc tao quan.': 'Liên hệ admin để được tạo quán.',
  'Quan ly mon an': 'Quản lý món ăn',
  'Quan ly don hang va thuc don cua quan.': 'Quản lý đơn hàng và thực đơn của quán.',
  'Chua co tai khoan?': 'Chưa có tài khoản?',
  'Dang ky khach hang': 'Đăng ký khách hàng',
  'Don hang quan': 'Đơn hàng quán',
  'Don hang gui toi quan': 'Đơn hàng gửi tới quán',
  'Xem va xac nhan don moi.': 'Xem và xác nhận đơn mới.',
  'Thuc don': 'Thực đơn',
  'Chua co don hang nao.': 'Chưa có đơn hàng nào.',
  'Khong co don hang phu hop bo loc.': 'Không có đơn hàng phù hợp bộ lọc.',
  'Tao tai Admin': 'Tạo tại Admin',
  'Quan ly nha hang': 'Quản lý nhà hàng',
  'Nha hang hien chua nhan don': 'Nhà hàng hiện chưa nhận đơn',
  'Tai khoan': 'Tài khoản',
  'Chua co dia chi': 'Chưa có địa chỉ',
  'Hoan thanh': 'Hoàn thành',
  // Auth pages & Navbar specific
  'Dang nhap khach hang': 'Đăng nhập khách hàng',
  'Dang nhap chu quan': 'Đăng nhập chủ quán',
  'Khong the dang nhap': 'Không thể đăng nhập',
  'Nhap mat khau cua ban': 'Nhập mật khẩu của bạn',
  'Dang dang nhap...': 'Đang đăng nhập...',
  'Dang nhap': 'Đăng nhập',
  'Khong the dang ky': 'Không thể đăng ký',
  'Tao tai khoan de dat mon ngay. Muon lam tai xe hoac mo quan? Dang ky tai trang chu sau khi dang nhap.': 'Tạo tài khoản để đặt món ngay. Muốn làm tài xế hoặc mở quán? Đăng ký tại trang chủ sau khi đăng nhập.',
  'Tao mat khau moi': 'Tạo mật khẩu mới',
  'Xac nhan mat khau': 'Xác nhận mật khẩu',
  'Nhap lai mat khau tren': 'Nhập lại mật khẩu trên',
  'Da co tai khoan?': 'Đã có tài khoản?',
  'Dang ky': 'Đăng ký',
  'Khach hang': 'Khách hàng',
  'Chu quan': 'Chủ quán',
  'Tai xe': 'Tài xế',
  'Dang nhap khac:': 'Đăng nhập khác:',
  'Dat mon, theo doi don hang va quan ly ho so.': 'Đặt món, theo dõi đơn hàng và quản lý hồ sơ.',
  'Ho ten': 'Họ tên',
  'So dien thoai': 'Số điện thoại',
  'Mat khau': 'Mật khẩu',
  'Dat mon': 'Đặt món',
  'Ho so': 'Hồ sơ',
  'Logout': 'Đăng xuất',
  'Com trua': 'Cơm trưa',
  'Bun pho': 'Bún phở',
  'Do uong': 'Đồ uống',
  'An vat': 'Ăn vặt',
  'Giam gia': 'Giảm giá'
};

walk('./src', function(err, results) {
  if (err) throw err;
  let count = 0;
  results.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    // First, do targeted replacements for exact matches to avoid side effects
    for (const [key, value] of Object.entries(dict)) {
      content = content.split(key).join(value);
    }
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      count++;
    }
  });
  console.log('Updated ' + count + ' files.');
});
