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

export default function TrafficLight({ activeColors = [] }) {
  const active = new Set(activeColors)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        background: '#0b1120',
        borderRadius: 7,
        padding: '5px 5px',
        border: '1px solid rgba(255,255,255,0.07)',
        flexShrink: 0,
      }}
    >
      {LIGHTS.map(({ color, on, glow, dim }) => {
        const isOn = active.has(color)
        return (
          <div
            key={color}
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              backgroundColor: isOn ? on : dim,
              boxShadow: isOn ? `0 0 7px 2px ${glow}` : 'none',
            }}
          />
        )
      })}
    </div>
  )
}
