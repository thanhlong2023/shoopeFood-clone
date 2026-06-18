const fs = require('fs');
const file = 'src/pages/TrackingPage.tsx';

let lines = fs.readFileSync(file, 'utf8').split('\n');

let startIndex = lines.findIndex(l => l.includes('{formatDuration(tracking?.route?.totalDurationMinutes)}'));
let endIndex = lines.findIndex((l, i) => i > startIndex && l.includes('{leg.label}'));

const replacementStr = `              <strong className="text-gray-900 truncate">{formatDuration(tracking?.route?.totalDurationMinutes)}</strong>
            </div>
            <div className="bg-white border border-gray-100 shadow-sm rounded-xl p-4 flex flex-col gap-1 col-span-2">
              <span className="text-xs text-gray-500 font-semibold uppercase tracking-wide">Quãng đường</span>
              <strong className="text-gray-900 truncate">{formatDistance(tracking?.route?.totalDistanceKm)}</strong>
            </div>
          </div>

          <DriverProfilePanel driverId={tracking?.driver?.id} />

          <div className="driver-route-list">
            {routeLegs.map((leg) => (
              <div key={leg.key} className="driver-route-leg">
                <div>
                  <strong>{leg.label}</strong>`;

const replaceLines = replacementStr.split('\n').map((l, i, arr) => i < arr.length - 1 ? l + '\r' : l);
lines.splice(startIndex, endIndex - startIndex + 1, ...replaceLines);

fs.writeFileSync(file, lines.join('\n'), 'utf8');
console.log('Successfully fixed TrackingPage.tsx');
