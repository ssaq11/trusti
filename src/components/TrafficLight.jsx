const LIGHTS = [
  { color: 'red',    on: '#ef4444', glow: 'rgba(239, 68, 68, 0.65)',  dim: 'rgba(239, 68, 68, 0.15)' },
  { color: 'yellow', on: '#facc15', glow: 'rgba(250, 204, 21, 0.65)', dim: 'rgba(250, 204, 21, 0.15)' },
  { color: 'green',  on: '#22c55e', glow: 'rgba(34, 197, 94, 0.65)',  dim: 'rgba(34, 197, 94, 0.15)' },
]

const SIZES = {
  sm: { circle: 10, gap: 3, px: 5,  py: 5,  r: 7  },
  md: { circle: 13, gap: 4, px: 6,  py: 6,  r: 9  },
  lg: { circle: 20, gap: 6, px: 8,  py: 9,  r: 11 },
}

export default function TrafficLight({ activeColors = [], size = 'sm', onColorClick }) {
  const active = new Set(activeColors)
  const { circle, gap, px, py, r } = SIZES[size] ?? SIZES.sm

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap,
        background: '#0b1120',
        borderRadius: r,
        padding: `${py}px ${px}px`,
        border: '1px solid rgba(255,255,255,0.07)',
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
              boxShadow: isOn ? `0 0 8px 3px ${glow}` : 'none',
              cursor: onColorClick ? 'pointer' : 'default',
            }}
          />
        )
      })}
    </div>
  )
}
