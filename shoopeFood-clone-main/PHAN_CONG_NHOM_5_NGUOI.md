# Phan cong nhom 5 nguoi - GrabFood Monolith

## Muc tieu
- Moi nguoi nhan 1 phan DB thi nhan luon UI phan do.
- Ban lam phan kho nhat: dat don + theo doi ban do realtime.
- Toan bo team dung chung API contract de ghep nhanh.

## Co cau nhom (5 nguoi)

### Nguoi 1 (Ban) - Core Ordering + Realtime Map (Kho nhat)
- DB: orders, order_items, luong cap nhat trang thai don.
- Backend:
  - Tao luong dat don end-to-end.
  - Tinh phi ship, tong tien, validate trang thai don.
  - API theo doi don theo thoi gian thuc.
- UI:
  - Man hinh dat don (checkout).
  - Man hinh theo doi don (timeline + map).
  - UI ban do realtime (vi tri tai xe).
- Socket:
  - Event cap nhat vi tri tai xe, trang thai don.

### Nguoi 2 - User + Driver
- DB: users, driver_details.
- Backend:
  - CRUD user/driver.
  - API bat/tat online cho tai xe.
  - API thong tin tai xe (xe, bien so, rating).
- UI:
  - Trang quan ly user.
  - Trang quan ly tai xe.
  - Form sua profile tai xe.

### Nguoi 3 - Restaurant
- DB: restaurants.
- Backend:
  - CRUD restaurant.
  - API dong/mo cua hang, cap nhat toa do.
- UI:
  - Trang danh sach nha hang.
  - Trang chi tiet nha hang.
  - Form tao/sua nha hang.

### Nguoi 4 - Menu
- DB: categories, food_items.
- Backend:
  - CRUD category.
  - CRUD food item.
  - API tim kiem/loc mon an theo nha hang.
- UI:
  - Trang quan ly menu theo nha hang.
  - Form them/sua mon.
  - Danh sach mon an co bo loc.

### Nguoi 5 - Order Ops + Payment Stub
- DB: orders (ho tro van hanh), lien ket payment_method.
- Backend:
  - API danh sach don cho admin/merchant.
  - API cap nhat trang thai don (xac nhan, huy, dang giao, hoan tat).
  - Stub thanh toan (CASH/E-WALLET) + log ket qua.
- UI:
  - Dashboard don hang cho admin/merchant.
  - Trang cap nhat trang thai don.
  - Bo loc don theo trang thai/thoi gian.

## Nguyen tac phan chia
- Nguoi nao nhan bang DB nao thi nhan luon UI cua bang do.
- Khong duoc tach backend 1 nguoi, frontend 1 nguoi cho cung 1 module.
- Moi module phai co:
  - API CRUD + validate.
  - UI list/create/update/delete.
  - Test duong happy path.

## API contract toi thieu (de ghep)
- Response thanh cong: { message, data }
- Response loi: { message }
- Status code:
  - 200: Lay/sua/xoa thanh cong.
  - 201: Tao moi thanh cong.
  - 400: Validate loi.
  - 404: Khong tim thay.
  - 500: Loi he thong.

## Ke hoach 7 ngay (goi y)
- Ngay 1: Chot schema, route, assignment chi tiet.
- Ngay 2-3: Moi nguoi xong CRUD backend + DB mapping module cua minh.
- Ngay 4-5: Moi nguoi xong UI module cua minh.
- Ngay 6: Ban ghep luong dat don + realtime map, ca team fix integration.
- Ngay 7: Test tong, fix bug, chuan bi demo.

## Definition of Done (DoD)
- Co API + UI chay duoc tren local.
- Co du lieu hien thi that tu DB.
- Co it nhat 1 video ngan hoac screenshot cho module.
- Merge vao nhanh chinh khong conflict nghiem trong.

## Quy uoc lam viec
- Nhanh branch: feat/<ten-module>-<ten-nguoi>
- Commit mau:
  - feat(module): add create/update api
  - fix(module): handle null data on UI
- PR phai co:
  - Mo ta thay doi.
  - Cac endpoint lien quan.
  - Anh chup UI.
