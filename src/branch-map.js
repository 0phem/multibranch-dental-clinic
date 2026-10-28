import L from 'leaflet'

/**
 * Interactive pinnable map for branch administration (OWN-03).
 * Allows the clinic owner to click or drag a pin to set branch coordinates.
 */
export function mountBranchPinMap(container, { latitude, longitude, onChange }) {
  if (!container || typeof window === 'undefined') return () => {}

  const initialLat = Number(latitude) || 14.8016
  const initialLng = Number(longitude) || 120.9328

  let map = null
  let disposed = false

  try {
    map = L.map(container, {
      center: [initialLat, initialLng],
      zoom: 15,
      dragging: true,
      scrollWheelZoom: true,
      zoomControl: true,
      attributionControl: false,
    })

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
    }).addTo(map)

    const pinIcon = L.divIcon({
      className: 'branch-pin-marker',
      html: `<div style="transform: translate(-50%, -100%); display: flex; flex-direction: column; align-items: center; cursor: grab;">
        <svg width="32" height="40" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 18 12 18s12-9 12-18c0-6.627-5.373-12-12-12z" fill="#0284c7"/>
          <circle cx="12" cy="11" r="5" fill="#ffffff"/>
        </svg>
      </div>`,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    })

    const marker = L.marker([initialLat, initialLng], {
      draggable: true,
      icon: pinIcon,
    }).addTo(map)

    const updateCoords = (lat, lng) => {
      if (disposed) return
      onChange({
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
      })
    }

    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      updateCoords(pos.lat, pos.lng)
    })

    map.on('click', (e) => {
      marker.setLatLng(e.latlng)
      updateCoords(e.latlng.lat, e.latlng.lng)
    })

    return () => {
      disposed = true
      map.remove()
    }
  } catch (err) {
    if (map) {
      try { map.remove() } catch {}
    }
    return () => {}
  }
}
