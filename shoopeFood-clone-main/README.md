# ShopeeFood Clone System

Dự án này là hệ thống clone của ShopeeFood / GrabFood, bao gồm 3 thành phần chính:
1. **Backend (Monolith)**: Node.js, Express, Sequelize (MySQL), Socket.io.
2. **Web Client**: React.js, Vite, TailwindCSS.
3. **Mobile App**: Ứng dụng Android Native (Java/Kotlin, Gradle).

Dưới đây là hướng dẫn chi tiết cách cài đặt và chạy từng thành phần.

---

## 1. Chạy Backend Server (`grab-food-monolith`)

Backend quản lý logic chính của toàn bộ hệ thống, cung cấp RESTful APIs và Realtime WebSockets.

### Yêu cầu tiên quyết
- Node.js (v18 trở lên)
- MySQL Server đang chạy

### Các bước thực hiện
1. Mở Terminal và di chuyển vào thư mục backend:
   ```bash
   cd grab-food-monolith
   ```
2. Cài đặt các thư viện:
   ```bash
   npm install
   ```
3. Cấu hình cơ sở dữ liệu:
   - Nếu bạn có thay đổi cấu hình MySQL (không dùng `root:123456` mặc định), hãy tạo một file `.env` dựa theo biến môi trường cần thiết (VD: `DB_USER=root`, `DB_PASSWORD=123456`, `DB_NAME=grabfood_db`).
4. Khởi động Server:
   ```bash
   npm run dev
   ```
   > **Lưu ý**: Ở lần chạy đầu tiên, hệ thống sẽ kết nối với MySQL, tự động tạo cơ sở dữ liệu `grabfood_db`, khởi tạo cấu trúc bảng và tự động chèn một bộ dữ liệu mẫu (Seed Data) thực tế tại TP. HCM.
5. Server sẽ lắng nghe ở cổng mặc định: `http://localhost:3000`.

---

## 2. Chạy Web Client (`client/fe_fegrapfood`)

Web Client dùng để cung cấp giao diện quản lý nhà hàng, trang dành cho Admin và web đặt thức ăn.

### Các bước thực hiện
1. Mở một cửa sổ Terminal mới và di chuyển vào thư mục Web Client:
   ```bash
   cd client/fe_fegrapfood
   ```
2. Cài đặt các package phụ thuộc:
   ```bash
   npm install
   ```
3. Khởi động Web Server (sử dụng Vite):
   ```bash
   npm run dev
   ```
4. Mở trình duyệt và truy cập vào đường dẫn mà Vite cung cấp (thường là `http://localhost:5173`).

---

## 3. Chạy Mobile App (`Mobile`)

Ứng dụng Mobile cung cấp trải nghiệm sử dụng trực tiếp trên điện thoại, được thiết kế cho hệ sinh thái Android.

### Yêu cầu tiên quyết
- **Android Studio** đã được cài đặt trên máy.
- Android Emulator (Máy ảo) hoặc thiết bị Android thật (đã bật chế độ USB Debugging).

### Các bước thực hiện bằng Android Studio (Khuyên dùng)
1. Khởi động **Android Studio**.
2. Chọn **File > Open** và trỏ đến thư mục `Mobile` nằm trong project này (`shoopeFood-clone-main/Mobile`).
3. Chờ một lúc để Android Studio tự động chạy **Gradle Sync** và tải về các thư viện Native.
4. Đảm bảo bạn đã khởi động một thiết bị ảo (AVD) hoặc đã cắm cáp kết nối thiết bị Android thật.
5. Nhấn nút **Run (▶️)** màu xanh lá cây trên thanh công cụ hoặc nhấn tổ hợp phím `Shift + F10` để build và khởi chạy App.

### Các bước thực hiện bằng Terminal (Không cần mở IDE)
Nếu không muốn mở Android Studio, bạn có thể build và cài đặt trực tiếp qua giao diện dòng lệnh:
1. Mở Terminal và đi vào thư mục Mobile:
   ```bash
   cd Mobile
   ```
2. Build và cài đặt APK thẳng lên thiết bị / máy ảo đang kết nối:
   - Trên **Windows**:
     ```bash
     gradlew installDebug
     ```
   - Trên **Mac/Linux**:
     ```bash
     ./gradlew installDebug
     ```

---
**💡 Mẹo Testing**: Bộ dữ liệu tự động (Seed Data) đã tạo sẵn rất nhiều tài khoản thực tế (Customer, Driver, Merchant, Admin). Tất cả tài khoản mẫu đều dùng chung mật khẩu là `123`. Bạn có thể dùng luôn các tài khoản này để đăng nhập và thử nghiệm các luồng (đặt đơn, nhận đơn, giao hàng) trên Web và Mobile nhé!
---

## Address Autocomplete Provider

Address suggestions are served by the backend at:

- `GET /api/addresses/suggest?q=...`
- `GET /api/addresses/detail/:placeId`
- `GET /api/addresses/reverse?lat=...&lng=...`

The default provider is VietMap. Configure `grab-food-monolith/.env` with:

```env
ADDRESS_PROVIDER=vietmap
VIETMAP_API_KEY=your_vietmap_key_here
```

If `VIETMAP_API_KEY` is missing, the backend logs a warning and falls back to the small mock provider for development. The frontend never calls VietMap directly and never stores the API key.
