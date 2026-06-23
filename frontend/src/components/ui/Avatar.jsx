import clsx from 'clsx';

const COLORS = [
  'from-pink-500 to-rose-500',
  'from-violet-500 to-purple-500',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-green-500',
  'from-amber-500 to-orange-500',
  'from-indigo-500 to-blue-500',
];

const getColor = (name) => {
  if (!name) return COLORS[0];
  const code = name.charCodeAt(0) + (name.charCodeAt(1) || 0);
  return COLORS[code % COLORS.length];
};

const getInitials = (name) => {
  if (!name) return '?';
  const parts = name.split(' ').filter(Boolean);
  return parts.length === 1 ? name[0].toUpperCase() : (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
};

export default function Avatar({ src, name, size = 40, online, className }) {
  const style = { width: size, height: size, minWidth: size };
  const fontSize = size < 32 ? 10 : size < 48 ? 13 : size < 64 ? 16 : 20;

  return (
    <div className={clsx('relative inline-flex flex-shrink-0', className)}>
      {src ? (
        <img
          src={src}
          alt={name || 'Avatar'}
          className="avatar"
          style={style}
          onError={e => { e.target.style.display = 'none'; e.target.nextSibling?.style.removeProperty('display'); }}
        />
      ) : null}
      <div
        className={clsx(
          'avatar flex items-center justify-center font-semibold text-white bg-gradient-to-br flex-shrink-0',
          getColor(name),
          src ? 'hidden' : 'flex'
        )}
        style={{ ...style, fontSize }}
      >
        {getInitials(name)}
      </div>
      {online !== undefined && (
        <span
          className={clsx(
            'absolute bottom-0 right-0 rounded-full border-2'
          )}
          style={{
            width: Math.max(8, size * 0.25),
            height: Math.max(8, size * 0.25),
            borderColor: 'var(--bg-sidebar)',
            background: online ? 'var(--accent)' : '#6b7280',
          }}
        />
      )}
    </div>
  );
}
