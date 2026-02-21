interface Props {
  onClose: () => void;
}

const ROWS = [
  {
    bg: 'bg-green-500 dark:bg-green-600',
    icon: '✓',
    label: 'Correct',
    desc: 'Exact match',
  },
  {
    bg: 'bg-orange-400 dark:bg-orange-500',
    icon: '↗',
    label: 'Adjacent region',
    desc: 'Neighbouring region — arrow points toward the mystery region',
  },
  {
    bg: 'bg-red-500 dark:bg-red-600',
    icon: '↗',
    label: 'Wrong region',
    desc: 'Non-adjacent region — arrow points toward the mystery region',
  },
  {
    bg: 'bg-red-500 dark:bg-red-600',
    icon: '✗',
    label: 'Wrong',
    desc: 'No match (operator or station type)',
  },
  {
    bg: 'bg-amber-400 dark:bg-amber-500',
    icon: '↑',
    label: 'Higher',
    desc: 'Mystery value is higher (platforms or footfall)',
  },
  {
    bg: 'bg-amber-400 dark:bg-amber-500',
    icon: '↓',
    label: 'Lower',
    desc: 'Mystery value is lower (platforms or footfall)',
  },
];

export default function KeyModal({ onClose }: Props) {
  return (
    <div
      className="fixed inset-0 z-20 flex items-center justify-center bg-black/50"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white dark:bg-gray-800 p-8 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute right-4 top-4 text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 text-xl"
        >
          ✕
        </button>

        <h2 className="text-xl font-bold text-gray-900 dark:text-gray-50 mb-4">How to read the tiles</h2>

        <div className="flex flex-col gap-3">
          {ROWS.map(({ bg, icon, label, desc }) => (
            <div key={label} className="flex items-center gap-3">
              <div className={`${bg} w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-base shrink-0`}>
                {icon}
              </div>
              <div>
                <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">{label}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400">{desc}</p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-5 rounded-lg bg-gray-100 dark:bg-gray-700 px-4 py-3 text-xs text-gray-600 dark:text-gray-300">
          <p className="font-semibold mb-1">Categories (left to right)</p>
          <p>Operators · Region · Platforms · Footfall · Type</p>
        </div>
      </div>
    </div>
  );
}
