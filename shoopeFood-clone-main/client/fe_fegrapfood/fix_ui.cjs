const fs = require('fs');
const file = 'src/pages/TrackingPage.tsx';

let lines = fs.readFileSync(file, 'utf8').split('\n');

// Find start line index: <span>ETA</span>
let startIndex = lines.findIndex(l => l.includes('<span>ETA</span>'));

// Find end line index: Đặt thêm món
let endIndex = lines.findIndex((l, i) => i > startIndex && l.includes('Đặt thêm món'));
// The Link close tag is one line below endIndex
endIndex += 1;

const replacementStr = `              <span>ETA</span>
              <strong>{formatDuration(tracking?.route?.totalDurationMinutes)}</strong>
            </div>
            <div>
              <span>Quãng đường</span>
              <strong>{formatDistance(tracking?.route?.totalDistanceKm)}</strong>
            </div>
          </div>

          <DriverProfilePanel driverId={tracking?.driver?.id} />

          <div className="driver-route-list">
            {routeLegs.map((leg) => (
              <div key={leg.key} className="driver-route-leg">
                <div>
                  <strong>{leg.label}</strong>
                  <span>{leg.ok ? \`\${formatDistance(leg.distanceKm)} - \${formatDuration(leg.durationMinutes)}\` : leg.error || 'Chưa có lộ trình'}</span>
                </div>
              </div>
            ))}
          </div>

          <div className="tracking-items mt-6">
            <h2 className="text-lg font-extrabold text-gray-800 mb-4 border-b border-gray-100 pb-2">Món đã đặt</h2>
            <div className="flex flex-col gap-4">
              {(tracking?.order.items || []).map((item) => (
                <div key={item.id} className="tracking-item flex items-center gap-4">
                  <div
                    className={\`w-16 h-16 min-w-[64px] rounded-xl bg-gray-50 border border-gray-100 flex items-center justify-center text-[10px] text-gray-400 font-bold bg-cover bg-center \${item.imageUrl ? '' : 'tracking-item-thumb--placeholder'}\`}
                    style={foodPhotoStyle(item.imageUrl, item.id)}
                  >
                    {!item.imageUrl ? <span>Chưa ảnh</span> : null}
                  </div>
                  <div className="flex-1 flex justify-between items-center min-w-0 gap-3">
                    <span className="font-semibold text-gray-700 text-sm truncate">
                      <strong className="text-brand mr-1">{item.quantity}x</strong> {item.foodName || \`Món #\${item.foodId}\`}
                    </span>
                    <strong className="text-sm text-gray-900 whitespace-nowrap">{formatCurrency(item.lineTotal)}</strong>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {tracking ? (
            <div className="order-price-section mt-6 p-5 bg-gray-50 rounded-2xl border border-gray-100 flex flex-col gap-3">
              <div className="order-price-row flex justify-between text-sm text-gray-600 font-medium">
                <span>Tạm tính</span>
                <span className="font-bold text-gray-900">{formatCurrency(tracking.order.subtotalAmount)}</span>
              </div>
              <div className="order-price-row flex justify-between text-sm text-gray-600 font-medium">
                <span>Phí giao hàng</span>
                <span className="font-bold text-gray-900">{formatCurrency(tracking.order.shippingFee)}</span>
              </div>
              {tracking.order.discountAmount > 0 ? (
                <div className="order-price-row discount flex justify-between text-sm text-brand font-medium">
                  <span>Giảm giá</span>
                  <span className="font-bold">-{formatCurrency(tracking.order.discountAmount)}</span>
                </div>
              ) : null}
              {tracking.order.taxAmount > 0 ? (
                <div className="order-price-row flex justify-between text-sm text-gray-600 font-medium">
                  <span>Thuế</span>
                  <span className="font-bold text-gray-900">{formatCurrency(tracking.order.taxAmount)}</span>
                </div>
              ) : null}
              <div className="order-price-divider border-t border-gray-200 border-dashed my-1" />
              <div className="order-price-row total flex justify-between text-base font-bold text-gray-900">
                <span>Tổng thanh toán</span>
                <span className="text-brand text-lg">{formatCurrency(tracking.order.totalAmount)}</span>
              </div>
            </div>
          ) : null}

          <Link className="button-secondary block text-center w-full mt-6 py-3.5 px-4 bg-white border-2 border-brand text-brand font-extrabold rounded-xl hover:bg-brand-light transition-colors" to="/food">
            Đặt thêm món
          </Link>`;

const replaceLines = replacementStr.split('\n').map(l => l + '\r'); // add carriage return to match file
lines.splice(startIndex, endIndex - startIndex + 1, ...replaceLines);

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Successfully fixed TrackingPage.tsx');
