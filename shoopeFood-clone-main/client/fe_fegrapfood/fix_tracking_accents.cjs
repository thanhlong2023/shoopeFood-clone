const fs = require("fs");
const file = "src/pages/TrackingPage.tsx";

if (!fs.existsSync(file)) process.exit(1);

let content = fs.readFileSync(file, "utf8");

const dict = {
  "Tai xe da nhan don": "Tài xế đã nhận đơn",
  "Don ": "Đơn ",
  "Da hieu": "Đã hiểu",
  "da nhan don va dang di lay mon cho ban.":
    "đã nhận đơn và đang đi lấy món cho bạn.",
  "Tai xe dang giao den ban": "Tài xế đang giao đến bạn",
  "da lay mon xong va dang chuan bi giao den cho ban.":
    "đã lấy món xong và đang chuẩn bị giao đến cho bạn.",
  "Vui long chuan bi tien mat: ": "Vui l�ng chu?n b? ti?n m?t: ",
  "Da giao hang thanh cong": "�� giao h�ng th�nh c�ng",
  "da giao don hang den cho ban thanh cong.":
    "d� giao don h�ng d?n cho b?n th�nh c�ng.",
  "Tong gia tri don: ": "T?ng gi� tr? don: ",
  "Cam on ban da su dung dich vu!": "C?m on b?n d� s? d?ng d?ch v?!",
  "Theo doi truc tiep": "Theo d�i tr?c ti?p",
  "Don hang cua ban": "�on h�ng c?a b?n",
  " don da dat � ": " don d� d?t � ",
  " don dang xu ly": " don dang x? l�",
  "Dang tai thong tin don hang...": "�ang t?i th�ng tin don h�ng...",
  "Dang tai": "�ang t?i",
  "Cho tai xe": "Ch? t�i x?",
  "Nha hang": "Nh� h�ng",
  "Dang cap nhat": "�ang c?p nh?t",
  "Tai xe": "T�i x?",
  "Chua co tai xe": "Chua c� t�i x?",
  "SDT khach": "S�T kh�ch",
  "Bien so": "Bi?n s?",
  "Tien can thu": "Ti?n c?n thu",
  "Quang duong": "Qu�ng du?ng",
  "Chua co lo trinh": "Chua c� l? tr�nh",
  "Mon da dat": "M�n d� d?t",
  "Chua anh": "Chua ?nh",
  "Mon #": "M�n #",
  "Tam tinh": "T?m t�nh",
  "Phi giao hang": "Ph� giao h�ng",
  "Giam gia": "Gi?m gi�",
  Thue: "Thu?",
  "Tong thanh toan": "T?ng thanh to�n",
  "Dat them mon": "�?t th�m m�n",
  "Danh gia nha hang": "��nh gi� nh� h�ng",
  "Don da hoan thanh, ban co the cham sao cho trai nghiem vua roi.":
    "�on d� ho�n th�nh, b?n c� th? ch?m sao cho tr?i nghi?m v?a r?i.",
  "Nhan xet ngan ve nha hang...": "Nh?n x�t ng?n v? nh� h�ng...",
  "Dang gui...": "�ang g?i...",
  "Gui danh gia": "G?i d�nh gi�",
  "Tat ca": "T?t c?",
  "Dang xu ly": "�ang x? l�",
  "Khong co don phu hop bo loc.": "Kh�ng c� don ph� h?p b? l?c.",
  "Dang xem": "�ang xem",
  Truoc: "Tru?c",
  Tiep: "Ti?p",
  "Chua co don hang de theo doi": "Chua c� don h�ng d? theo d�i",
  "Dat mon xong ban se thay tien trinh giao hang va lo trinh tai xe tai day.":
    "�?t m�n xong b?n s? th?y ti?n tr�nh giao h�ng v� l? tr�nh t�i x? t?i d�y.",
  "Dat mon ngay": "�?t m�n ngay",
  "Dang tai don hang cua ban...": "�ang t?i don h�ng c?a b?n...",
  "Chua co don hang nao": "Chua c� don h�ng n�o",
  "Dat mon de xem lich su va theo doi giao hang tai day.":
    "�?t m�n d? xem l?ch s? v� theo d�i giao h�ng t?i d�y.",
  "Khong the tai danh sach don hang": "Kh�ng th? t?i danh s�ch don h�ng",
  "Khong the tai tracking": "Kh�ng th? t?i tracking",
  "Da gui danh gia nha hang. Cam on ban!":
    "�� g?i d�nh gi� nh� h�ng. C?m on b?n!",
  "Khong the gui danh gia": "Kh�ng th? g?i d�nh gi�",
};

for (const [key, value] of Object.entries(dict)) {
  content = content.split(key).join(value);
}

content = content.replace(/Xem chi tiet/g, "Xem chi ti?t");
content = content.replace(/Theo doi/g, "Theo d�i");

fs.writeFileSync(file, content, "utf8");
console.log("Fixed TrackingPage accents");
