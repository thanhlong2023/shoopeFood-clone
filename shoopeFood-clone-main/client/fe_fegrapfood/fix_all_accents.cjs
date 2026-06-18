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
  'Quan ly menu theo nha hang': 'Qu?n lý menu theo nhà hàng',
  'loc danh muc va mon an.': 'l?c danh m?c và món an.',
  'Don hang': 'Ðon hàng',
  'Nha hang': 'Nhà hàng',
  'Quan ly menu': 'Qu?n lý menu',
  'gia va so luong mon moi ngay.': 'giá và s? lu?ng món m?i ngày.',
  'Quan ly tai xe': 'Qu?n lý tài x?',
  'bien so va trang thai online.': 'bi?n s? và tr?ng thái online.',
  'Quan ly tai khoan khach hang va nhan su.': 'Qu?n lý tài kho?n khách hàng và nhân s?.',
  'Chua co du lieu.': 'Chua có d? li?u.',
  'Chua co danh muc': 'Chua có danh m?c',
  'dang dang nhap voi role': 'dang dang nh?p v?i role',
  'Quan ly du lieu he thong.': 'Qu?n lý d? li?u h? th?ng.',
  'Quan ly thuc don online': 'Qu?n lý th?c don online',
  'Chua co link anh': 'Chua có link ?nh',
  'Chua co quan nao.': 'Chua có quán nào.',
  'Chua co chu quan.': 'Chua có ch? quán.',
  'Tao tai tab': 'T?o t?i tab',
  'Nguoi dung': 'Ngu?i dùng',
  'hoac dang nhap lai': 'ho?c dang nh?p l?i',
  'Chua co danh muc phu hop.': 'Chua có danh m?c phù h?p.',
  'Chua co quan nao duoc gan.': 'Chua có quán nào du?c gán.',
  'Lien he admin de duoc tao quan.': 'Liên h? admin d? du?c t?o quán.',
  'Quan ly mon an': 'Qu?n lý món an',
  'Quan ly don hang va thuc don cua quan.': 'Qu?n lý don hàng và th?c don c?a quán.',
  'Chua co tai khoan?': 'Chua có tài kho?n?',
  'Dang ky khach hang': 'Ðang ký khách hàng',
  'Don hang quan': 'Ðon hàng quán',
  'Don hang gui toi quan': 'Ðon hàng g?i t?i quán',
  'Xem va xac nhan don moi.': 'Xem và xác nh?n don m?i.',
  'Thuc don': 'Th?c don',
  'Chua co don hang nao.': 'Chua có don hàng nào.',
  'Khong co don hang phu hop bo loc.': 'Không có don hàng phù h?p b? l?c.',
  'Tao tai Admin': 'T?o t?i Admin',
  'Quan ly nha hang': 'Qu?n lý nhà hàng',
  'Nha hang hien chua nhan don': 'Nhà hàng hi?n chua nh?n don',
  'Tai khoan': 'Tài kho?n',
  'Chua co dia chi': 'Chua có d?a ch?',
  'Hoan thanh': 'Hoàn thành'
};

walk('./src', function(err, results) {
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
  console.log('Updated ' + count + ' files.');
});
