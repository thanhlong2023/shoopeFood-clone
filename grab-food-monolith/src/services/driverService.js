exports.findNearestDriver = (drivers = [], pickupPoint) => {
  if (!drivers.length) {
    return null;
  }

  const { lat: pickupLat, lng: pickupLng } = pickupPoint;

  return drivers.reduce((nearest, current) => {
    const nearestDistance = Math.hypot(nearest.lat - pickupLat, nearest.lng - pickupLng);
    const currentDistance = Math.hypot(current.lat - pickupLat, current.lng - pickupLng);
    return currentDistance < nearestDistance ? current : nearest;
  });
};
