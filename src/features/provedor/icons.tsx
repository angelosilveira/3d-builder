const paths = {
  tower: 'M12 5v15m-5 0h10M9 8a4 4 0 0 0 0 6m6-6a4 4 0 0 1 0 6M6 5a8 8 0 0 0 0 12M18 5a8 8 0 0 1 0 12',
  network: 'M9 3h6v5H9zM3 16h6v5H3zm12 0h6v5h-6zM12 8v4M6 16v-4h12v4',
  map: 'm3 5 6-2 6 3 6-2v15l-6 2-6-3-6 2zm6-2v15m6-12v15',
  pin: 'M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 1 1 14 0zM14 10a2 2 0 1 1-4 0 2 2 0 0 1 4 0z',
  people:
    'M16 20v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2m10-13a4 4 0 1 1-8 0 4 4 0 1 1 8 0zm3-3a4 4 0 0 1 0 7m1 3a4 4 0 0 1 3 4v2',
  signal: 'm2 8 0 0a16 16 0 0 1 20 0M5 12a11 11 0 0 1 14 0m-11 4a6 6 0 0 1 8 0m-4 4h.01',
  alert: 'm10.4 4.5-8 14A1.6 1.6 0 0 0 3.8 21h16.4a1.6 1.6 0 0 0 1.4-2.5l-8-14a1.8 1.8 0 0 0-3.2 0zM12 9v5m0 3h.01',
  layers: 'm3 7 9-5 9 5-9 5zm0 5 9 5 9-5m-18 5 9 5 9-5',
  arrow: 'm9 5 7 7-7 7',
  back: 'm14 5-7 7 7 7',
  exit: 'M10 4H4v16h6m-1-8h12m-5-5 5 5-5 5',
  plus: 'M12 5v14m-7-7h14',
  minus: 'M5 12h14',
  rotate: 'M20 8a8 8 0 1 0 .6 6M20 3v5h-5',
  focus: 'M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5m-1-9a3 3 0 1 1-6 0 3 3 0 0 1 6 0z',
  pause: 'M8 5v14m8-14v14',
  play: 'm7 4 13 8-13 8z',
  search: 'M17 10a7 7 0 1 1-14 0 7 7 0 1 1 14 0zm-2 5 6 6',
  bill: 'M5 3h14v18l-3-2-4 2-4-2-3 2zm3 5h8m-8 4h8',
  obra: 'M5 21h6M8 21V5m0 0 12 2.5M8 5 4 8.5h4M8 3v2m9 2.1V12m-1.4 0h2.8v2.2h-2.8z',
  calendar: 'M4 6h16v15H4zm0 5h16M8 3v5m8-5v5',
}
export function Icon({ name }: { name: keyof typeof paths }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.65"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={paths[name]} />
    </svg>
  )
}
