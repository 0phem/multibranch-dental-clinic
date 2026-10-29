import L from 'leaflet'
import 'leaflet/dist/leaflet.css'

/**
 * Interactive pinnable map for branch administration (OWN-03).
 * Allows the clinic owner to click or drag a pin to set branch coordinates.
 */
export function mountBranchPinMap(container, { latitude, longitude, onChange }) {
  if (!container || typeof window === 'undefined') return () => {}

  const hasCoordinates = (lat, lng) => lat !== null && lat !== undefined && lat !== '' && lng !== null && lng !== undefined && lng !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lng))
  const pinned = hasCoordinates(latitude, longitude)
  // Retain the existing starting viewport; it is never emitted or saved as a branch location.
  const initialLat = pinned ? Number(latitude) : 14.8016
  const initialLng = pinned ? Number(longitude) : 120.9328

  let map = null
  let disposed = false

  try {
    map = L.map(container, {
      center: [initialLat, initialLng],
      zoom: 15,
      dragging: true,
      scrollWheelZoom: true,
      zoomControl: true,
      attributionControl: true,
    })

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map)

    const pinIcon = L.divIcon({
      className: 'branch-pin-marker',
      html: `<div style="display: flex; flex-direction: column; align-items: center; cursor: grab;">
        <svg width="32" height="40" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.373 0 0 5.373 0 12c0 9 12 18 12 18s12-9 12-18c0-6.627-5.373-12-12-12z" fill="currentColor"/>
          <circle cx="12" cy="11" r="5" fill="#ffffff"/>
        </svg>
      </div>`,
      iconSize: [32, 40],
      iconAnchor: [16, 40],
    })

    let marker = null
    const ensureMarker = (lat, lng) => {
      if (marker) { marker.setLatLng([lat, lng]); return }
      marker = L.marker([lat, lng], {
        draggable: true,
        title: 'Branch location pin',
        icon: pinIcon,
      }).addTo(map)
      marker.on('dragend', () => {
        const pos = marker.getLatLng()
        updateCoords(pos.lat, pos.lng)
      })
    }

    const updateCoords = (lat, lng) => {
      if (disposed) return
      onChange({
        latitude: Number(lat.toFixed(6)),
        longitude: Number(lng.toFixed(6)),
      })
    }

    if (pinned) ensureMarker(initialLat, initialLng)

    map.on('click', (e) => {
      ensureMarker(e.latlng.lat, e.latlng.lng)
      updateCoords(e.latlng.lat, e.latlng.lng)
    })

    const cleanup = () => {
      disposed = true
      map.remove()
    }
    cleanup.ready = true
    cleanup.setCoordinates = (lat, lng) => {
      if (disposed) return
      if (!hasCoordinates(lat, lng)) { if (marker) { marker.remove(); marker = null }; return }
      const current = marker?.getLatLng()
      if (current && Math.abs(current.lat - Number(lat)) < .000001 && Math.abs(current.lng - Number(lng)) < .000001) return
      ensureMarker(Number(lat), Number(lng))
      map.panTo([Number(lat), Number(lng)], { animate: false })
    }
    return cleanup
  } catch (err) {
    if (map) {
      try { map.remove() } catch {}
    }
    return () => {}
  }
}
