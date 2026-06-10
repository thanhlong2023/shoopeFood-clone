# ShoopeFood Mobile (Android - Java)

Ung dung Android khach hang ket noi truc tiep voi backend `grab-food-monolith` cua du an.

## Yeu cau

- Android Studio Hedgehog (2023.1.1) tro len
- JDK 17
- Backend chay tai `http://localhost:3000`

## Mo project

1. Mo Android Studio
2. Chon **Open** va chon thu muc `Mobile/`
3. Doi Gradle sync hoan tat
4. Chay backend truoc:

```bash
cd grab-food-monolith
npm install
npm start
```

## Cau hinh API

Mac dinh app dung:

- **Android Emulator**: `http://10.0.2.2:3000/`
- **Thiet bi that**: doi `API_BASE_URL` trong `app/build.gradle`

```gradle
buildConfigField "String", "API_BASE_URL", "\"http://192.168.x.x:3000/\""
```

Thay `192.168.x.x` bang IP may chay backend (cung mang Wi-Fi voi dien thoai).

## Tai khoan test (seed database)

| Vai tro   | So dien thoai | Mat khau |
|-----------|---------------|----------|
| CUSTOMER  | 0900000001    | 123456   |

App mobile hien tai dang nhap vai **CUSTOMER**.

## Chuc nang

- Dang nhap (`POST /api/auth/login`)
- Xem danh sach nha hang (`GET /api/restaurants`)
- Xem mon an theo nha hang (`GET /api/foods?restaurantId=...`)
- Gio hang va dat hang (`POST /api/orders`)
- Xem don hang (`GET /api/orders?customerId=...`)
- Chi tiet va theo doi don (`GET /api/orders/:id`, `/tracking`)

## Cau truc thu muc

```
Mobile/
  app/src/main/java/com/shoopefood/mobile/
    adapter/      RecyclerView adapters
    cart/         Quan ly gio hang trong bo nho
    model/        DTO map voi JSON backend
    network/      Retrofit + OkHttp
    session/      Luu JWT token
    ui/           Activities
    util/         Tien ich hien thi
  app/src/main/res/   Layout, strings, theme
```

## Cong nghe

- Java 17
- Material Components
- Retrofit 2 + Gson
- RecyclerView + SwipeRefreshLayout

## Luu y khi debug

1. Backend phai bat va co du lieu seed
2. Emulator khong dung `localhost` - dung `10.0.2.2`
3. Thiet bi that can quyen Internet va cung mang voi may backend
4. HTTP cleartext da bat cho moi truong dev (`network_security_config.xml`)

## Mo rong tiep theo

- Man hinh DRIVER / MERCHANT rieng
- Socket.IO theo doi don realtime (backend da co socket)
- Google Maps cho vi tri nha hang va shipper
