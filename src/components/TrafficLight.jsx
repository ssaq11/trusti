const LIGHTS = [
  {
    color: 'red',
    on: '#ef4444',
    glow: 'rgba(239, 68, 68, 0.65)',
    dim: 'rgba(239, 68, 68, 0.15)',
  },
  {
    color: 'yellow',
    on: '#facc15',
    glow: 'rgba(250, 204, 21, 0.65)',
    dim: 'rgba(250, 204, 21, 0.15)',
  },
  {
    color: 'green',
    on: '#22c55e',
    glow: 'rgba(34, 197, 94, 0.65)',
    dim: 'rgba(34, 197, 94, 0.15)',
  },
]

export default function TrafficLight({ activeColors = [], size = 'sm', onColorClick }) {
  const active = new Set(activeColors)

  const circleSize = size === 'lg' ? 14 : 10
  const gap = size === 'lg' ? 5 : 3
  const paddingX = size === 'lg' ? 6 : 5
  const paddingY = size === 'lg' ? 7 : 5
  const borderRadius = size === 'lg' ? 9 : 7

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap,
        background: '#0b1120',
        borderRadius,
        padding: `${paddingY}px ${paddingX}px`,
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
              width: circleSize,
              height: circleSize,
              borderRadius: '50%',
              backgroundColor: isOn ? on : dim,
              boxShadow: isOn ? `0 0 7px 2px ${glow}` : 'none',
              cursor: onColorClick ? 'pointer' : 'default',
            }}
          />
        )
      })}
    </div>
  )
}
