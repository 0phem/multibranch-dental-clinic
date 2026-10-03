// One informational map. Gesture handlers are never enabled.
export const clinicMapOptions = Object.freeze({
  dragging: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false,
  touchZoom: false,
  tapHold: false,
  zoomControl: false,
  attributionControl: false, // Accessible attribution lives outside the aria-hidden canvas.
  zoomAnimation: false,
  fadeAnimation: false,
  markerZoomAnimation: false,
  trackResize: false,
})
