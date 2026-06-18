const fs = require('fs');
const file = 'src/pages/TrackingPage.tsx';

if (!fs.existsSync(file)) process.exit(1);

let content = fs.readFileSync(file, 'utf8');

const dict = {
  'Tai xe da nhan don': 'Tài x? dã nh?n don',
  'Don ': 'Ðon ',
  'Da hieu': 'Ðã hi?u',
  'da nhan don va dang di lay mon cho ban.': 'dã nh?n don và dang di l?y món cho b?n.',
  'Tai xe dang giao den ban': 'Tài x? dang giao d?n b?n',
  'da lay mon xong va dang chuan bi giao den cho ban.': 'dã l?y món xong và dang chu?n b? giao d?n cho b?n.',
  'Vui long chuan bi tien mat: ': 'Vui lòng chu?n b? ti?n m?t: ',
  'Da giao hang thanh cong': 'Ðã giao hàng thành công',
  'da giao don hang den cho ban thanh cong.': 'dã giao don hàng d?n cho b?n thành công.',
  'Tong gia tri don: ': 'T?ng giá tr? don: ',
  'Cam on ban da su dung dich vu!': 'C?m on b?n dã s? d?ng d?ch v?!',
  'Theo doi truc tiep': 'Theo dõi tr?c ti?p',
  'Don hang cua ban': 'Ðon hàng c?a b?n',
  ' don da dat · ': ' don dã d?t · ',
  ' don dang xu ly': ' don dang x? lý',
  'Dang tai thong tin don hang...': 'Ðang t?i thông tin don hàng...',
  'Dang tai': 'Ðang t?i',
  'Cho tai xe': 'Ch? tài x?',
  'Nha hang': 'Nhà hàng',
  'Dang cap nhat': 'Ðang c?p nh?t',
  'Tai xe': 'Tài x?',
  'Chua co tai xe': 'Chua có tài x?',
  'SDT khach': 'SÐT khách',
  'Bien so': 'Bi?n s?',
  'Tien can thu': 'Ti?n c?n thu',
  'Quang duong': 'Quãng du?ng',
  'Chua co lo trinh': 'Chua có l? trình',
  'Mon da dat': 'Món dã d?t',
  'Chua anh': 'Chua ?nh',
  'Mon #': 'Món #',
  'Tam tinh': 'T?m tính',
  'Phi giao hang': 'Phí giao hàng',
  'Giam gia': 'Gi?m giá',
  'Thue': 'Thu?',
  'Tong thanh toan': 'T?ng thanh toán',
  'Dat them mon': 'Ð?t thêm món',
  'Danh gia nha hang': 'Ðánh giá nhà hàng',
  'Don da hoan thanh, ban co the cham sao cho trai nghiem vua roi.': 'Ðon dã hoàn thành, b?n có th? ch?m sao cho tr?i nghi?m v?a r?i.',
  'Nhan xet ngan ve nha hang...': 'Nh?n xét ng?n v? nhà hàng...',
  'Dang gui...': 'Ðang g?i...',
  'Gui danh gia': 'G?i dánh giá',
  'Tat ca': 'T?t c?',
  'Dang xu ly': 'Ðang x? lý',
  'Khong co don phu hop bo loc.': 'Không có don phù h?p b? l?c.',
  'Dang xem': 'Ðang xem',
  'Truoc': 'Tru?c',
  'Tiep': 'Ti?p',
  'Chua co don hang de theo doi': 'Chua có don hàng d? theo dõi',
  'Dat mon xong ban se thay tien trinh giao hang va lo trinh tai xe tai day.': 'Ð?t món xong b?n s? th?y ti?n trình giao hàng và l? trình tài x? t?i dây.',
  'Dat mon ngay': 'Ð?t món ngay',
  'Dang tai don hang cua ban...': 'Ðang t?i don hàng c?a b?n...',
  'Chua co don hang nao': 'Chua có don hàng nào',
  'Dat mon de xem lich su va theo doi giao hang tai day.': 'Ð?t món d? xem l?ch s? và theo dõi giao hàng t?i dây.',
  'Khong the tai danh sach don hang': 'Không th? t?i danh sách don hàng',
  'Khong the tai tracking': 'Không th? t?i tracking',
  'Da gui danh gia nha hang. Cam on ban!': 'Ðã g?i dánh giá nhà hàng. C?m on b?n!',
  'Khong the gui danh gia': 'Không th? g?i dánh giá'
};

for (const [key, value] of Object.entries(dict)) {
  content = content.split(key).join(value);
}

content = content.replace(/Xem chi tiet/g, 'Xem chi ti?t');
content = content.replace(/Theo doi/g, 'Theo dõi');

fs.writeFileSync(file, content, 'utf8');
console.log('Fixed TrackingPage accents');
