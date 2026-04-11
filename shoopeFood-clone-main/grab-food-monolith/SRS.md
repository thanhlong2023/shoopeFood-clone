# Tài Liệu Đặc Tả Yêu Cầu Phần Mềm (SRS)

## 1. Giới thiệu

### 1.1 Mục đích
Tài liệu này mô tả đặc tả yêu cầu phần mềm cho hệ thống backend của dự án GrabFood clone. Mục tiêu của backend là cung cấp API phục vụ quản lý người dùng, tài xế, nhà hàng, thực đơn, đơn hàng và mô phỏng thanh toán cho một dự án học tập full-stack.

### 1.2 Phạm vi
Hệ thống hỗ trợ các chức năng chính sau:

- Quản lý người dùng và tài xế
- Quản lý nhà hàng
- Quản lý menu theo danh mục và món ăn
- Tạo đơn hàng và theo dõi trạng thái
- Tính phí giao hàng và tổng tiền
- Mô phỏng luồng thanh toán để demo

Backend này hướng tới môi trường chạy local, phục vụ học tập, làm đồ án và demo. Hệ thống chưa nhắm tới triển khai production quy mô lớn.

## 2. Tổng quan hệ thống

Backend GrabFood clone là một ứng dụng monolith viết bằng Node.js và Express. Hệ thống cung cấp REST API cho frontend sử dụng và dùng MySQL làm cơ sở dữ liệu chính. Sequelize được dùng để ánh xạ dữ liệu giữa code và database. Ngoài ra hệ thống có Socket.IO để hỗ trợ tính năng realtime như cập nhật vị trí tài xế.

Các module chính:

- Người dùng: lưu thông tin khách hàng, chủ quán, quản trị viên
- Tài xế: lưu thông tin giao hàng
- Nhà hàng: quản lý thông tin nhà hàng, vị trí, trạng thái mở cửa
- Danh mục: nhóm món ăn theo nhà hàng
- Món ăn: các món bán trong menu
- Đơn hàng: lưu thông tin đặt món, tổng tiền, trạng thái
- Chi tiết đơn hàng: các món nằm trong đơn
- Thanh toán giả lập: phục vụ demo, chưa tích hợp cổng thanh toán thật

## 3. Thiết kế cơ sở dữ liệu

Hệ thống sử dụng cơ sở dữ liệu quan hệ. Các bảng chính như sau.

### 3.1 Bảng `users`

Lưu thông tin người dùng như khách hàng, chủ nhà hàng, quản trị viên hoặc tài xế.

Các trường đề xuất:

- `id`: khóa chính
- `full_name`: họ tên người dùng
- `email`: email duy nhất
- `phone`: số điện thoại
- `password_hash`: mật khẩu đã mã hóa
- `role`: vai trò như customer, owner, admin, driver
- `created_at`: thời gian tạo
- `updated_at`: thời gian cập nhật

### 3.2 Bảng `drivers`

Lưu thông tin tài xế, liên kết với bảng người dùng.

Các trường đề xuất:

- `id`: khóa chính
- `user_id`: khóa ngoại tới `users.id`
- `vehicle_type`: loại xe
- `license_plate`: biển số xe
- `is_online`: trạng thái sẵn sàng nhận đơn
- `current_latitude`: vĩ độ hiện tại
- `current_longitude`: kinh độ hiện tại
- `rating_avg`: điểm đánh giá trung bình
- `created_at`: thời gian tạo
- `updated_at`: thời gian cập nhật

### 3.3 Bảng `restaurants`

Lưu thông tin nhà hàng.

Các trường bắt buộc theo dự án:

- `id`: khóa chính
- `ownerId`: khóa ngoại tới người sở hữu nhà hàng
- `name`: tên nhà hàng
- `address`: địa chỉ
- `latitude`: vĩ độ
- `longitude`: kinh độ
- `isOpen`: trạng thái mở hoặc đóng
- `imageUrl`: đường dẫn hình ảnh
- `ratingAvg`: điểm đánh giá trung bình

Khi lưu ở database có thể chuẩn hóa theo kiểu:

- `owner_id`
- `created_at`
- `updated_at`

### 3.4 Bảng `categories`

Lưu danh mục món ăn của từng nhà hàng.

Các trường đề xuất:

- `id`: khóa chính
- `restaurant_id`: khóa ngoại tới `restaurants.id`
- `name`: tên danh mục
- `description`: mô tả
- `created_at`: thời gian tạo
- `updated_at`: thời gian cập nhật

### 3.5 Bảng `food_items`

Lưu thông tin món ăn trong menu.

Các trường đề xuất:

- `id`: khóa chính
- `category_id`: khóa ngoại tới `categories.id`
- `name`: tên món ăn
- `description`: mô tả món
- `price`: giá bán
- `image_url`: ảnh món ăn
- `is_available`: trạng thái còn bán hay không
- `created_at`: thời gian tạo
- `updated_at`: thời gian cập nhật

### 3.6 Bảng `orders`

Lưu thông tin chính của đơn hàng.

Các trường bắt buộc theo dự án:

- `id`: khóa chính
- `user_id`: khóa ngoại tới khách hàng
- `restaurant_id`: khóa ngoại tới nhà hàng
- `status`: trạng thái đơn hàng
- `total_amount`: tổng tiền cuối cùng

Các trường mở rộng nên có:

- `driver_id`: tài xế giao đơn
- `receiver_address`: địa chỉ nhận hàng
- `shipping_fee`: phí giao hàng
- `subtotal_amount`: tạm tính tiền món
- `payment_method`: phương thức thanh toán
- `payment_status`: trạng thái thanh toán
- `created_at`: thời gian tạo
- `updated_at`: thời gian cập nhật

### 3.7 Bảng `order_items`

Lưu các món nằm trong từng đơn hàng.

Các trường đề xuất:

- `id`: khóa chính
- `order_id`: khóa ngoại tới `orders.id`
- `food_item_id`: khóa ngoại tới `food_items.id`
- `quantity`: số lượng
- `unit_price`: đơn giá tại thời điểm đặt hàng
- `line_total`: thành tiền của dòng
- `created_at`: thời gian tạo
- `updated_at`: thời gian cập nhật

## 4. Đặc tả API

Tất cả API trả về dữ liệu dạng JSON. Format response thành công chuẩn:

```json
{
  "message": "Success",
  "data": {}
}
```

Format response lỗi chuẩn:

```json
{
  "message": "Error message"
}
```

### 4.1 API nhà hàng

#### GET /api/restaurants

Mục đích: lấy danh sách tất cả nhà hàng.

Ví dụ response:

```json
{
  "message": "Success",
  "data": [
    {
      "id": 1,
      "ownerId": 3,
      "name": "Com Tam Sai Gon",
      "address": "123 Nguyen Trai",
      "latitude": 10.762622,
      "longitude": 106.660172,
      "isOpen": true,
      "imageUrl": "https://example.com/restaurant.jpg",
      "ratingAvg": 4.6
    }
  ]
}
```

#### POST /api/restaurants

Mục đích: tạo mới nhà hàng.

Request body:

- `ownerId`
- `name`
- `address`
- `latitude`
- `longitude`
- `isOpen`
- `imageUrl`
- `ratingAvg`

#### PUT /api/restaurants/:id

Mục đích: cập nhật nhà hàng theo ID.

Request body:

- `ownerId`
- `name`
- `address`
- `latitude`
- `longitude`
- `isOpen`
- `imageUrl`
- `ratingAvg`

#### DELETE /api/restaurants/:id

Mục đích: xóa nhà hàng theo ID.

### 4.2 API người dùng

Các endpoint đề xuất:

- `GET /api/users`: lấy danh sách người dùng
- `GET /api/users/:id`: lấy chi tiết người dùng
- `POST /api/users`: tạo người dùng mới
- `PUT /api/users/:id`: cập nhật người dùng
- `DELETE /api/users/:id`: xóa người dùng

Các trường phổ biến:

- `id`
- `full_name`
- `email`
- `phone`
- `role`

### 4.3 API menu

API menu gồm phần danh mục và món ăn.

Endpoint danh mục:

- `GET /api/categories`
- `GET /api/categories/:id`
- `POST /api/categories`
- `PUT /api/categories/:id`
- `DELETE /api/categories/:id`

Endpoint món ăn:

- `GET /api/foods`
- `GET /api/foods/:id`
- `POST /api/foods`
- `PUT /api/foods/:id`
- `DELETE /api/foods/:id`

Các trường phổ biến của danh mục:

- `id`
- `restaurant_id`
- `name`
- `description`

Các trường phổ biến của món ăn:

- `id`
- `category_id`
- `name`
- `description`
- `price`
- `image_url`
- `is_available`

### 4.4 API đơn hàng

Các endpoint đề xuất:

- `GET /api/orders`: lấy danh sách đơn hàng
- `GET /api/orders/:id`: lấy chi tiết đơn hàng
- `POST /api/orders`: tạo đơn hàng mới
- `PUT /api/orders/:id`: cập nhật đơn hàng
- `PUT /api/orders/:id/status`: cập nhật trạng thái đơn hàng
- `DELETE /api/orders/:id`: xóa đơn hàng

Request body điển hình:

- `user_id`
- `restaurant_id`
- `items`
- `receiver_address`
- `shipping_fee`
- `payment_method`

Ví dụ đối tượng đơn hàng trả về:

```json
{
  "id": 1001,
  "user_id": 5,
  "restaurant_id": 2,
  "status": "PENDING",
  "total_amount": 85000
}
```

### 4.5 API thanh toán (giả lập)

Module thanh toán hiện chỉ là stub để phục vụ demo. Hệ thống chưa kết nối cổng thanh toán thật.

Các endpoint đề xuất:

- `POST /api/payments/create`
- `POST /api/payments/callback`
- `GET /api/payments/:orderId`

Các trường chính:

- `order_id`
- `payment_method`
- `amount`
- `payment_status`
- `transaction_code`

Các phương thức demo:

- `CASH`
- `E_WALLET`

## 5. Logic nghiệp vụ

### 5.1 Quy tắc nhà hàng

- Nhà hàng bắt buộc phải có `name` và `address`.
- `ownerId` phải tồn tại trong bảng người dùng trước khi tạo nhà hàng.
- `latitude` và `longitude` phải là số hợp lệ.
- `ratingAvg` nên là số hợp lệ trong khoảng hợp lý, ví dụ từ 0 đến 5.

### 5.2 Quy tắc đơn hàng

- Một đơn hàng phải có ít nhất một món.
- `user_id` phải tồn tại.
- `restaurant_id` phải tồn tại.
- Mỗi `food_item_id` trong `order_items` phải tồn tại.
- `quantity` phải lớn hơn 0.
- `subtotal_amount` là tổng tiền của tất cả dòng món ăn.
- `total = subtotal + shipping_fee`
- Nếu sau này có thêm thuế hoặc giảm giá thì công thức có thể mở rộng, nhưng bản đồ án cơ bản dùng tạm tính cộng phí giao hàng.

### 5.3 Luồng trạng thái đơn hàng

Luồng trạng thái khuyến nghị:

`PENDING -> CONFIRMED -> PREPARING -> DELIVERING -> COMPLETED`

Trường hợp kết thúc khác:

`PENDING -> CONFIRMED -> CANCELLED`

Quy tắc:

- Đơn đã hoàn thành không được quay lại trạng thái trước đó.
- Đơn đã hủy không được tiếp tục giao.
- Backend phải kiểm tra hợp lệ khi cập nhật trạng thái.

### 5.4 Quy tắc thanh toán

- Thanh toán hiện chỉ là mô phỏng.
- `CASH` có thể được giữ ở trạng thái chờ đến khi giao hàng xong.
- `E_WALLET` có thể được cập nhật là thanh toán thành công hoặc thất bại dựa trên kết quả giả lập.

## 6. Xử lý lỗi

### 6.1 Mã trạng thái HTTP

- `200 OK`: xử lý thành công
- `201 Created`: tạo mới thành công
- `400 Bad Request`: dữ liệu đầu vào sai hoặc thiếu
- `404 Not Found`: không tìm thấy tài nguyên
- `409 Conflict`: xung đột dữ liệu hoặc xung đột version
- `500 Internal Server Error`: lỗi hệ thống

### 6.2 Format phản hồi

Phản hồi thành công:

```json
{
  "message": "Success",
  "data": {}
}
```

Phản hồi lỗi:

```json
{
  "message": "Restaurant not found"
}
```

Ví dụ các lỗi validation:

- Thiếu tên nhà hàng
- Thiếu địa chỉ nhà hàng
- `ownerId` không tồn tại
- Tạo đơn hàng nhưng không có món nào
- Cập nhật trạng thái đơn hàng không hợp lệ

## 7. Hướng phát triển trong tương lai

- Thêm xác thực và phân quyền bằng JWT
- Tích hợp cổng thanh toán thật
- Bổ sung CRUD chi tiết đơn hàng và validation chặt hơn
- Thêm voucher và giảm giá
- Thêm tìm kiếm, lọc, phân trang cho nhà hàng và món ăn
- Thêm cơ chế gán tài xế và theo dõi đơn hàng realtime
- Thêm log lịch sử thay đổi đơn hàng và thanh toán
- Viết test API và test tích hợp tự động
- Bổ sung tài liệu OpenAPI hoặc Swagger
- Cải thiện kiểm soát đồng thời khi cập nhật đơn hàng

## 8. Kết luận

Tài liệu SRS này mô tả các yêu cầu cốt lõi của backend cho dự án GrabFood clone ở mức đồ án sinh viên. Hệ thống tập trung vào API CRUD rõ ràng, format phản hồi thống nhất, logic nghiệp vụ cơ bản và cấu trúc phù hợp để học backend với Express, Sequelize và MySQL.
