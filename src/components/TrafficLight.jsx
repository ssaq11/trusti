const LIGHTS = [
  { color: 'red',    on: '#ef4444', glow: 'rgba(239, 68, 68, 0.65)',  dim: 'rgba(239, 68, 68, 0.36)', label: 'skip' },
  { color: 'yellow', on: '#facc15', glow: 'rgba(250, 204, 21, 0.65)', dim: 'rgba(250, 204, 21, 0.36)', label: 'meh...' },
  { color: 'green',  on: '#22c55e', glow: 'rgba(34, 197, 94, 0.65)',  dim: 'rgba(34, 197, 94, 0.36)', label: 'go!' },
]

const SIZES = {
  sm:       { circle: 10, gap: 3, px: 5, py: 5,  r: 7  },
  md:       { circle: 13, gap: 4, px: 6, py: 6,  r: 9  },
  card:     { circle: 16, gap: 4, px: 5, py: 5,  r: 9  },
  'card-h': { circle: 22, gap: 6, px: 7, py: 4,  r: 12 },
  lg:       { circle: 20, gap: 6, px: 8, py: 9,  r: 11 },
}

export default function TrafficLight({ activeColors = [], size = 'sm', direction = 'column', onColorClick, userSelection, isEditing }) {
  const active = new Set(activeColors)
  const { circle, gap, px, py, r } = SIZES[size] ?? SIZES.sm

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: direction,
        alignItems: 'center',
        gap,
        background: 'radial-gradient(ellipse at 18% 22%, rgba(160,210,255,0.11) 0%, #000 62%)',
        borderRadius: r,
        padding: `${py}px ${px}px`,
        boxShadow: 'inset 1px 1px 3px rgba(180,220,255,0.05), 0 0 10px rgba(255,255,255,0.08)',
        flexShrink: 0,
      }}
    >
      {LIGHTS.map(({ color, on, glow, dim, label }) => {
        const isUserPick = userSelection === color
        const showActive = isEditing ? isUserPick : active.has(color)
        const currentOpacity = isEditing ? (isUserPick ? 1 : 0.3) : 1

        return (
          <div
            key={color}
            className="relative"
            onClick={onColorClick ? (e) => { e.stopPropagation(); onColorClick(color) } : undefined}
            style={{
              width: circle,
              height: circle,
              borderRadius: '50%',
              backgroundColor: showActive ? on : dim,
              boxShadow: showActive ? `0 0 8px 3px ${glow}` : 'inset 0 1px 2px rgba(255,255,255,0.18)',
              opacity: currentOpacity,
              transform: isUserPick ? 'scale(1.1)' : 'scale(1)',
              transition: 'opacity 0.2s, transform 0.2s',
              cursor: onColorClick ? 'pointer' : 'default',
            }}
          >
            {isUserPick && (
              <div className="absolute top-full mt-1.5 left-1/2 -translate-x-1/2 px-2.5 py-0.5 rounded-full text-[11px] font-medium tracking-wide bg-slate-800/60 backdrop-blur-lg border border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.5)] whitespace-nowrap z-50 pointer-events-none animate-in fade-in slide-in-from-top-1" style={{ color: on }}>
                {label}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}
