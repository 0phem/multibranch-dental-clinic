import React from 'react'

/**
 * 5-facet anatomical surface diagram:
 * - Center: Occlusal/Incisal (O)
 * - Top: Buccal (B)
 * - Bottom: Lingual (L)
 * - Left: Mesial (M)
 * - Right: Distal (D)
 */
export function SurfaceDiagram({ surfaces = [], onChange, readOnly = false, size = 110, fdi = '11' }) {
  const currentSurfaces = Array.isArray(surfaces) ? surfaces : []
  const q = Number(String(fdi)[0]) || 1
  // In dental anatomy, Mesial is towards midline.
  // For viewer left (patient right: Q1, Q4, Q5, Q8), midline is to the RIGHT.
  // For viewer right (patient left: Q2, Q3, Q6, Q7), midline is to the LEFT.
  const isRightOfMidlineInView = q === 2 || q === 3 || q === 6 || q === 7
  const leftSurface = isRightOfMidlineInView ? 'M' : 'D'
  const rightSurface = isRightOfMidlineInView ? 'D' : 'M'

  const toggle = (surface) => {
    if (readOnly || !onChange) return
    if (currentSurfaces.includes(surface)) {
      onChange(currentSurfaces.filter(s => s !== surface))
    } else {
      onChange([...currentSurfaces, surface])
    }
  }

  const isSelected = (surface) => currentSurfaces.includes(surface)

  const facetStyle = (surface) => ({
    fill: isSelected(surface) ? '#e0e7ff' : '#ffffff',
    stroke: isSelected(surface) ? '#4338ca' : '#cbd5e1',
    strokeWidth: isSelected(surface) ? 2 : 1.2,
    cursor: readOnly ? 'default' : 'pointer',
    transition: 'fill 0.15s ease, stroke 0.15s ease',
  })

  const textStyle = (surface) => ({
    fill: isSelected(surface) ? '#3730a3' : '#64748b',
    fontWeight: isSelected(surface) ? 700 : 500,
    fontSize: '11px',
    userSelect: 'none',
    pointerEvents: 'none',
  })

  // Geometry inside a 100x100 box:
  // Center: 32..68 x 32..68
  // Top: (0,0) to (100,0) to (68,32) to (32,32)
  // Bottom: (32,68) to (68,68) to (100,100) to (0,100)
  // Left: (0,0) to (32,32) to (32,68) to (0,100)
  // Right: (100,0) to (100,100) to (68,68) to (68,32)

  return (
    <div className="surface-diagram-container" style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width={size} height={size} viewBox="0 0 100 100" role="img" aria-label="Tooth surfaces diagram">
        {/* Top (Buccal) */}
        <polygon
          points="0,0 100,0 68,32 32,32"
          style={facetStyle('B')}
          onClick={() => toggle('B')}
        />
        <text x="50" y="20" textAnchor="middle" dominantBaseline="middle" style={textStyle('B')}>B</text>

        {/* Bottom (Lingual) */}
        <polygon
          points="32,68 68,68 100,100 0,100"
          style={facetStyle('L')}
          onClick={() => toggle('L')}
        />
        <text x="50" y="82" textAnchor="middle" dominantBaseline="middle" style={textStyle('L')}>L</text>

        {/* Left facet */}
        <polygon
          points="0,0 32,32 32,68 0,100"
          style={facetStyle(leftSurface)}
          onClick={() => toggle(leftSurface)}
        />
        <text x="18" y="50" textAnchor="middle" dominantBaseline="middle" style={textStyle(leftSurface)}>
          {leftSurface}
        </text>

        {/* Right facet */}
        <polygon
          points="100,0 100,100 68,68 68,32"
          style={facetStyle(rightSurface)}
          onClick={() => toggle(rightSurface)}
        />
        <text x="82" y="50" textAnchor="middle" dominantBaseline="middle" style={textStyle(rightSurface)}>
          {rightSurface}
        </text>

        {/* Center (Occlusal/Incisal) */}
        <rect
          x="32"
          y="32"
          width="36"
          height="36"
          style={facetStyle('O')}
          onClick={() => toggle('O')}
        />
        <text x="50" y="50" textAnchor="middle" dominantBaseline="middle" style={textStyle('O')}>O</text>
      </svg>
      <span style={{ fontSize: '11px', color: 'var(--muted, #64748b)', marginTop: '4px' }}>
        {readOnly ? 'Surfaces (M · O · D · B · L)' : 'Click facet or check below'}
      </span>
    </div>
  )
}
