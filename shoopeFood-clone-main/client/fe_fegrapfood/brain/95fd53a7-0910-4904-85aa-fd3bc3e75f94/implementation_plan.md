# Goal: Giữ nguyên giỏ hàng và tự động mở đúng quán ăn khi chỉnh sửa

Hiện tại, trạng thái giỏ hàng (`cart`) và quán ăn đang chọn (`activeRestaurantId`) chỉ được lưu cục bộ trong component (`HomePage` và `RestaurantDetailPage`). Khi chuyển trang (sang Theo dõi đơn, hoặc sang Thanh toán rồi nhấn "Chỉnh sửa"), component bị unmount nên giỏ hàng bị xoá sạch.

## Đề xuất thay đổi (Proposed Changes)

Để giải quyết vấn đề này mà không cần thay đổi quá lớn về kiến trúc (như dùng Redux), tôi sẽ sử dụng `sessionStorage` để lưu trạng thái giỏ hàng nháp (`CartDraft`).

### 1. Tạo module `src/utils/cartDraft.ts`
Tạo một file tiện ích để lưu và đọc dữ liệu giỏ hàng đang đặt dở (bao gồm `restaurantId`, `cart`, và `checkout`).

### 2. Cập nhật `src/pages/HomePage.tsx`
- **Khởi tạo state:** Thay vì bắt đầu với giỏ hàng rỗng `{}`, component sẽ đọc từ `getCartDraft()` để khôi phục `activeRestaurantId`, `cart`, và `checkout`.
- **Lưu state:** Thêm `useEffect` để liên tục ghi đè `cartDraft` vào `sessionStorage` mỗi khi người dùng thay đổi giỏ hàng hoặc thông tin giao hàng.
- **Tự động khôi phục:** Nhờ khôi phục `activeRestaurantId`, khi từ trang Thanh toán nhấn "Chỉnh sửa", HomePage sẽ tự động mở đúng thẻ quán ăn đang đặt với giỏ hàng được giữ nguyên!

### 3. Cập nhật `src/pages/RestaurantDetailPage.tsx`
- **Khởi tạo state:** Khi vào chi tiết một quán ăn (ví dụ ID là 5), component sẽ kiểm tra xem `cartDraft` có đang lưu giỏ hàng của quán 5 hay không. Nếu có, nó sẽ khôi phục lại giỏ hàng và dữ liệu checkout.
- **Lưu state:** Thêm `useEffect` để tự động lưu thay đổi giỏ hàng vào `sessionStorage`. Nhờ đó, nếu người dùng sang trang Tracking và quay lại, giỏ hàng vẫn còn nguyên.

### 4. Xử lý logic chuyển quán (Clear Cart)
- Khi chọn quán ăn mới (khác với quán đang lưu trong draft), giỏ hàng sẽ bị xoá (hoặc khởi tạo mới) để tránh việc lấy món của quán A đặt cho quán B. Logic này sẽ áp dụng tự động trong hàm `handleRestaurantSelect`.

## User Review Required

> [!IMPORTANT]
> - Giỏ hàng sẽ được lưu theo phiên duyệt web (`sessionStorage`), nghĩa là nếu bạn F5 (tải lại trang) hoặc chuyển qua chuyển lại giữa các trang thì giỏ hàng vẫn nguyên vẹn. Tuy nhiên nếu đóng hẳn tab/trình duyệt thì giỏ hàng sẽ bị mất (đúng với logic giỏ hàng thông thường của các app).
> - Bạn có đồng ý với phương án sử dụng `sessionStorage` như trên không?

## Verification Plan
1. Chọn quán ăn A, thêm món X và Y vào giỏ.
2. Chuyển sang trang Theo dõi đơn (`/tracking`) rồi nhấn Back quay lại `HomePage` hoặc `RestaurantDetailPage`. Giỏ hàng phải còn nguyên.
3. Bấm Thanh toán, ở màn hình Thanh toán nhấn "Chỉnh sửa giỏ hàng". Hệ thống phải quay lại trang chủ và **tự động mở giao diện quán ăn A** cùng với giỏ hàng đã chọn.
