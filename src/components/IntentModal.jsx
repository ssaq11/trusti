import { useState } from 'react'
import { X, Flag, AlertTriangle } from 'lucide-react'

export default function IntentModal({ place, initialType = 'try', onClose, onSubmit }) {
  const [type, setType] = useState(initialType)
  const [note, setNote] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit() {
    setLoading(true)
    await onSubmit({ type, note: note.trim() })
    setLoading(false)
  }

  return (
    <div
      className="fixed inset-0 bg-black/50 z-[60] flex items-end sm:items-center justify-center"
      onClick={onClose}
    >
      <div
        className="bg-slate-900 w-full max-w-md rounded-t-2xl sm:rounded-2xl mb-16 sm:mb-0 p-5"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-white truncate pr-2">{place.name}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-white p-1 shrink-0">
            <X size={20} />
          </button>
        </div>

        {/* Type toggle */}
        <div className="flex gap-2 mb-4">
          <button
            onClick={() => setType('try')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors ${
              type === 'try'
                ? 'bg-green-500/20 text-green-400 ring-1 ring-green-500/50'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <Flag size={15} />
            Want to go
          </button>
          <button
            onClick={() => setType('pass')}
            className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-medium transition-colors ${
              type === 'pass'
                ? 'bg-red-500/20 text-red-400 ring-1 ring-red-500/50'
                : 'bg-slate-800 text-slate-400 hover:text-white'
            }`}
          >
            <AlertTriangle size={15} />
            Heard things
          </button>
        </div>

        {/* Notes */}
        <textarea
          value={note}
          onChange={e => setNote(e.target.value.slice(0, 200))}
          placeholder="Add a reason or note… (optional)"
          className="w-full bg-slate-800 text-white text-sm rounded-xl p-3 resize-none h-24 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-600"
        />
        <div className="text-right text-[10px] text-slate-500 mt-1 mb-4">{note.length}/200</div>

        <button
          onClick={handleSubmit}
          disabled={loading}
          className={`w-full py-3 rounded-xl text-sm font-semibold transition-colors disabled:opacity-50 ${
            type === 'try'
              ? 'bg-green-500 hover:bg-green-400 text-white'
              : 'bg-red-500 hover:bg-red-400 text-white'
          }`}
        >
          {loading ? 'Saving…' : type === 'try' ? 'Flag it!' : "I'll pass"}
        </button>
      </div>
    </div>
  )
}
