const fs = require('fs');
const file = 'src/pages/TrackingPage.tsx';

let lines = fs.readFileSync(file, 'utf8').split('\n');

// Find start line index: <CircleMarker center=...
let startIndex = lines.findIndex(l => l.includes('<CircleMarker center={[simulatedDriverLocation.latitude'));

// Find end line index: <div> \n <span>Quãng đường</span>
let endIndex = lines.findIndex((l, i) => i > startIndex && l.includes('<span>Quãng đường</span>'));
// The Quãng đường block ends 2 lines below endIndex
endIndex += 2;

const replacementStr = `                <CircleMarker center={[simulatedDriverLocation.latitude, simulatedDriverLocation.longitude]} radius={16} pathOptions={{ color: 'brand', opacity: 0.2 }} />
              </>
            ) : null}
          </MapContainer>
        </div>

        <aside className="tracking-card">
          <div className="tracking-card-head">
            <span>{isLoading ? 'Đang tải' : tracking?.order.statusLabel || tracking?.order.statusCode || 'Chờ tài xế'}</span>
            <strong>{tracking ? \`\${tracking.routeProgress}%\` : '0%'}</strong>
          </div>

          <StatusSteps order={tracking?.order || null} />

          <div className="grid grid-cols-2 gap-4 mt-6">
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Nhà hàng</span>
              <strong className="text-gray-900 truncate" title={tracking?.restaurant?.name}>{tracking?.restaurant?.name || 'Đang cập nhật'}</strong>
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Tài xế</span>
              <strong className="text-gray-900 truncate" title={tracking?.driver?.fullName}>{tracking?.driver?.fullName || 'Chưa có tài xế'}</strong>
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">SĐT khách</span>
              <strong className="text-gray-900 truncate">{tracking?.order.customerPhone || '-'}</strong>
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Biển số</span>
              <strong className="text-gray-900 truncate">{tracking?.driver?.licensePlate || '-'}</strong>
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Tiền cần thu</span>
              <strong className="text-gray-900 truncate">{tracking ? formatCurrency(tracking.order.cashToCollect) : '-'}</strong>
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex flex-col gap-1">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">ETA</span>
              <strong className="text-gray-900 truncate">{formatDuration(tracking?.route?.totalDurationMinutes)}</strong>
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex flex-col gap-1 col-span-2">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Quãng đường</span>
              <strong className="text-gray-900 truncate">{formatDistance(tracking?.route?.totalDistanceKm)}</strong>
            </div>
          </div>`;

const replaceLines = replacementStr.split('\n').map(l => l + '\r'); // add carriage return to match file
lines.splice(startIndex, endIndex - startIndex + 1, ...replaceLines);

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Successfully fixed TrackingPage.tsx');
