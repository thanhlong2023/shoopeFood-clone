const fs = require('fs');
const file = 'src/pages/TrackingPage.tsx';

let content = fs.readFileSync(file, 'utf8');

const targetStart = `              <strong className="text-gray-900 truncate">{formatDuration(tracking?.route?.totalDurationMinutes)}</strong>
`;
const targetEnd = `                <div>
                  <strong>{leg.label}</strong>`;

const replacement = `              <strong className="text-gray-900 truncate">{formatDuration(tracking?.route?.totalDurationMinutes)}</strong>
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
`;

const startIndex = content.indexOf(targetStart);
if (startIndex === -1) throw new Error("Could not find start");

const endIndex = content.indexOf(targetEnd, startIndex);
if (endIndex === -1) throw new Error("Could not find end");

const newContent = content.substring(0, startIndex) + replacement + content.substring(endIndex);

fs.writeFileSync(file, newContent, 'utf8');
console.log('Restored the missing lines!');
