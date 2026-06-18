const fs = require('fs');
const files = [
  'src/pages/DriverPage.tsx',
  'src/pages/MerchantOrdersPage.tsx'
];

const dict = {
  'Tai xe': 'Tài x?',
  'Don hang quanh ban': 'Ðon hàng quanh b?n',
  'Dang lay vi tri GPS...': 'Ðang l?y v? trí GPS...',
  'Trinh duyet khong ho tro GPS, dung vi tri cuoi cung neu co.': 'Trình duy?t không h? tr? GPS, dùng v? trí cu?i cùng n?u có.',
  'GPS dang cap nhat': 'GPS dang c?p nh?t',
  'Khong the gui vi tri': 'Không th? g?i v? trí',
  'Chua duoc cap quyen GPS, dung vi tri cuoi cung tren he thong.': 'Chua du?c c?p quy?n GPS, dùng v? trí cu?i cùng trên h? th?ng.',
  'Khong the tai bang tai xe': 'Không th? t?i b?ng tài x?',
  'Ban dang co don dang giao. Hoan thanh don hien tai truoc khi nhan don moi.': 'B?n dang có don dang giao. Hoàn thành don hi?n t?i tru?c khi nh?n don m?i.',
  'Khong the nhan don': 'Không th? nh?n don',
  'Khong the cap nhat trang thai': 'Không th? c?p nh?t tr?ng thái',
  'Dang giao don khac': 'Ðang giao don khác',
  'Nhan don': 'Nh?n don',
  'Tai lai don': 'T?i l?i don',
  'Don moi da xac nhan': 'Ðon m?i dã xác nh?n',
  'Don moi gan ban': 'Ðon m?i g?n b?n',
  'Chua co don CONFIRMED nao. Hay cho merchant xac nhan don truoc.': 'Chua có don CONFIRMED nào. Hãy ch? merchant xác nh?n don tru?c.',
  'Don cua toi': 'Ðon c?a tôi',
  'Ban chua nhan don nao.': 'B?n chua nh?n don nào.',
  'Don dang chon': 'Ðon dang ch?n',
  'Chon don de xem chi tiet': 'Ch?n don d? xem chi ti?t',
  'Nha hang': 'Nhà hàng',
  'Khach hang': 'Khách hàng',
  'SDT khach': 'SÐT khách',
  'Tien can thu': 'Ti?n c?n thu',
  'Quang duong': 'Quãng du?ng',
  'Den nha hang': 'Ð?n nhà hàng',
  'Da lay mon': 'Ðã l?y món',
  'Hoan thanh': 'Hoàn thành',
  'Huy don': 'H?y don',
  'Chua co route OSRM cho don nay.': 'Chua có route OSRM cho don này.',
  'Hoa don': 'Hóa don',
  'Mon can lay': 'Món c?n l?y',
  'Don nay chua co chi tiet mon trong du lieu tra ve.': 'Ðon này chua có chi ti?t món trong d? li?u tr? v?.',
  'Tien mon': 'Ti?n món',
  'Phi giao hang': 'Phí giao hàng',
  'Thue': 'Thu?',
  'Giam gia': 'Gi?m giá',
  'Tong don': 'T?ng don',
  'Khong co don dang chon.': 'Không có don dang ch?n.',
  'Chua co lo trinh': 'Chua có l? trình',
  'Don cua quan': 'Ðon c?a quán',
  'Cho xac nhan': 'Ch? xác nh?n',
  'Dang giao': 'Ðang giao',
  'Lich su': 'L?ch s?',
  'Tai lai': 'T?i l?i',
  'Khong the tai don cua quan': 'Không th? t?i don c?a quán',
  'Da xac nhan don': 'Ðã xác nh?n don',
  'Khong the xac nhan don': 'Không th? xác nh?n don',
  'Xac nhan': 'Xác nh?n',
  'Thoi gian dat': 'Th?i gian d?t',
  'Mon an': 'Món an',
  'Trang thai': 'Tr?ng thái',
  'Thanh tien': 'Thành ti?n',
  'Huy': 'H?y',
  'Da huy': 'Ðã h?y',
  'Dang chuan bi': 'Ðang chu?n b?',
  'Chon don': 'Ch?n don'
};

files.forEach(file => {
  if (!fs.existsSync(file)) return;
  let content = fs.readFileSync(file, 'utf8');
  for (const [key, value] of Object.entries(dict)) {
    content = content.split(key).join(value);
  }
  fs.writeFileSync(file, content, 'utf8');
  console.log('Fixed ' + file);
});
