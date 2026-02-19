const LIGHTS = [
  { color: 'red',    on: '#ef4444', glow: 'rgba(239, 68, 68, 0.65)',  dim: 'rgba(239, 68, 68, 0.28)' },
  { color: 'yellow', on: '#facc15', glow: 'rgba(250, 204, 21, 0.65)', dim: 'rgba(250, 204, 21, 0.28)' },
  { color: 'green',  on: '#22c55e', glow: 'rgba(34, 197, 94, 0.65)',  dim: 'rgba(34, 197, 94, 0.28)' },
]

const SIZES = {
  sm:       { circle: 10, gap: 3, px: 5, py: 5,  r: 7  },
  md:       { circle: 13, gap: 4, px: 6, py: 6,  r: 9  },
  card:     { circle: 16, gap: 4, px: 5, py: 5,  r: 9  },
  'card-h': { circle: 22, gap: 6, px: 7, py: 4,  r: 12 },
  lg:       { circle: 20, gap: 6, px: 8, py: 9,  r: 11 },
}

export default function TrafficLight({ activeColors = [], size = 'sm', direction = 'column', hang = false, onColorClick }) {
  const active = new Set(activeColors)
  const { circle, gap, px, py, r } = SIZES[size] ?? SIZES.sm

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction,
        alignItems: 'center',
        gap,
        background: 'radial-gradient(ellipse at 18% 22%, rgba(160,210,255,0.22) 0%, #000 62%)',
        borderRadius: r,
        padding: `${py}px ${px}px`,
        boxShadow: 'inset 1px 1px 3px rgba(180,220,255,0.1)',
        flexShrink: 0,
      }}
    >
      {LIGHTS.map(({ color, on, glow, dim }) => {
        const isOn = active.has(color)
        return (
          <div
            key={color}
            onClick={onColorClick ? (e) => { e.stopPropagation(); onColorClick(color) } : undefined}
            style={{
              width: circle,
              height: circle,
              borderRadius: '50%',
              backgroundColor: isOn ? on : dim,
              boxShadow: isOn ? `0 0 8px 3px ${glow}` : 'inset 0 1px 2px rgba(255,255,255,0.18)',
              cursor: onColorClick ? 'pointer' : 'default',
            }}
          />
        )
      })}
    </div>
  )
}
