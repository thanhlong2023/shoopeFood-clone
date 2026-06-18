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

// Map from corrupted to clean
const dict = {
  'Qun lA menu theo nhA hAng': 'Quản lý menu theo nhà hàng',
  'l?c danh mc vA mA3n n.': 'lọc danh mục và món ăn.',
  '?n hAng': 'Đơn hàng',
  'NhA hAng': 'Nhà hàng',
  'Qun lA menu': 'Quản lý menu',
  'giA vA s` lng mA3n m-i ngAy.': 'giá và số lượng món mỗi ngày.',
  'Qun lA tAi x': 'Quản lý tài xế',
  'bin s` vA trng thAi online.': 'biển số và trạng thái online.',
  'Qun lA tAi khon khAch hAng vA nhAn s.': 'Quản lý tài khoản khách hàng và nhân sự.',
  'Cha cA3 d_ liu.': 'Chưa có dữ liệu.',
  'Cha cA3 danh mc': 'Chưa có danh mục',
  '`ang `ng nh-p v>i role': 'đang đăng nhập với role',
  'Qun lA d_ liu h th`ng.': 'Quản lý dữ liệu hệ thống.',
  'Qun lA thc `n online': 'Quản lý thực đơn online',
  'Cha cA3 link nh': 'Chưa có link ảnh',
  'Cha cA3 quAn nAo.': 'Chưa có quán nào.',
  'Cha cA3 ch  quAn.': 'Chưa có chủ quán.',
  'To ti tab': 'Tạo tại tab',
  'Ng?i dA1ng': 'Người dùng',
  'hoc `ng nh-p li': 'hoặc đăng nhập lại',
  'Cha cA3 danh mc phA1 hp.': 'Chưa có danh mục phù hợp.',
  'Cha cA3 quAn nAo `c gAn.': 'Chưa có quán nào được gán.',
  'LiAn h admin ` `c to quAn.': 'Liên hệ admin để được tạo quán.',
  'Qun lA mA3n n': 'Quản lý món ăn',
  'Qun lA `n hAng vA thc `n c a quAn.': 'Quản lý đơn hàng và thực đơn của quán.',
  'Cha cA3 tAi khon?': 'Chưa có tài khoản?',
  '?ng kA khAch hAng': 'Đăng ký khách hàng',
  '?n hAng quAn': 'Đơn hàng quán',
  '?n hAng g-i t>i quAn': 'Đơn hàng gửi tới quán',
  'Xem vA xAc nh-n `n m>i.': 'Xem và xác nhận đơn mới.',
  'Thc `n': 'Thực đơn',
  'Cha cA3 `n hAng nAo.': 'Chưa có đơn hàng nào.',
  'KhA\'ng cA3 `n hAng phA1 hp bT l?c.': 'Không có đơn hàng phù hợp bộ lọc.',
  'To ti Admin': 'Tạo tại Admin',
  'Qun lA nhA hAng': 'Quản lý nhà hàng',
  'NhA hAng hin cha nh-n `n': 'Nhà hàng hiện chưa nhận đơn',
  'TAi khon': 'Tài khoản',
  'Cha cA3 `<a ch%': 'Chưa có địa chỉ',
  'HoAn thAnh': 'Hoàn thành',
  '?ng nh-p khAch hAng': 'Đăng nhập khách hàng',
  '?ng nh-p ch  quAn': 'Đăng nhập chủ quán',
  'KhA\'ng th `ng nh-p': 'Không thể đăng nhập',
  'Nh-p m-t khcu c a bn': 'Nhập mật khẩu của bạn',
  '?ang `ng nh-p...': 'Đang đăng nhập...',
  '?ng nh-p': 'Đăng nhập',
  'KhA\'ng th `ng kA': 'Không thể đăng ký',
  'To tAi khon ` `t mA3n ngay. Mu`n lAm tAi x hoc mY quAn? ?ng kA ti trang ch  sau khi `ng nh-p.': 'Tạo tài khoản để đặt món ngay. Muốn làm tài xế hoặc mở quán? Đăng ký tại trang chủ sau khi đăng nhập.',
  'To m-t khcu m>i': 'Tạo mật khẩu mới',
  'XAc nh-n m-t khcu': 'Xác nhận mật khẩu',
  'Nh-p li m-t khcu trAn': 'Nhập lại mật khẩu trên',
  '?A cA3 tAi khon?': 'Đã có tài khoản?',
  '?ng kA': 'Đăng ký',
  'KhAch hAng': 'Khách hàng',
  'Ch  quAn': 'Chủ quán',
  'TAi x': 'Tài xế',
  '?ng nh-p khAc:': 'Đăng nhập khác:',
  '?t mA3n, theo dAi `n hAng vA qun lA h" s.': 'Đặt món, theo dõi đơn hàng và quản lý hồ sơ.',
  'H? tAn': 'Họ tên',
  'S` `in thoi': 'Số điện thoại',
  'M-t khcu': 'Mật khẩu',
  '?t mA3n': 'Đặt món',
  'H" s': 'Hồ sơ',
  '?ng xut': 'Đăng xuất',
  'Cm tra': 'Cơm trưa',
  'BAn phY': 'Bún phở',
  '?" u`ng': 'Đồ uống',
  ',n vt': 'Ăn vặt',
  'Gim giA': 'Giảm giá',

  // Also include the unaccented mapping to proper accents in case any were missed
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

walk('./client/fe_fegrapfood/src', function(err, results) {
  if (err) throw err;
  let count = 0;
  results.forEach(file => {
    let content = fs.readFileSync(file, 'utf8');
    let original = content;
    
    for (const [key, value] of Object.entries(dict)) {
      content = content.split(key).join(value);
    }
    
    if (content !== original) {
      fs.writeFileSync(file, content, 'utf8');
      count++;
    }
  });
  console.log('Fixed encoding in ' + count + ' files.');
});
