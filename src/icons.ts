/** Shared 24px drawing field; colour comes from the surrounding control. */
const symbols = {
  undo: '<path d="m8.5 3.5-5 5 5 5M3.5 8.5h11a6 6 0 1 1-5.2 9"/>',
  hint: '<path d="M8 15.2a7 7 0 1 1 8 0c-1.2.9-1.6 1.8-1.6 3.3H9.6c0-1.5-.4-2.4-1.6-3.3ZM9.5 18.5h5m-4 3h3m-3-11.5 1.5 1.5 1.5-1.5M12 11.5V15"/>',
  back: '<path d="m15.5 5-7 7 7 7"/>',
  close: '<path d="m6 6 12 12M18 6 6 18"/>',
  check: '<path d="m5 12 4.5 4.5L19 7"/>',
  book: '<rect x="5.5" y="3" width="14.5" height="18" rx="1.6"/><path d="M9 3v18M3.5 7h4M3.5 12h4M3.5 17h4M12 8h5M12 12h4"/>',
  arrow: '<path d="m8.5 5 7 7-7 7"/>',
  add: '<path d="M12 4v16M4 12h16"/>',
  menu: '<path d="M5 7h14M5 12h14M5 17h14"/>',
};
export function icon(name: keyof typeof symbols) {
  return `<svg class="seed-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false">${symbols[name]}</svg>`;
}

/** Seasonal engravings keep the notebook/seed character rather than generic badges. */
const emblems = [
  Array.from(
    { length: 6 },
    (_, i) =>
      `<path transform="rotate(${i * 60} 12 12)" d="M12 12V3m-2 2 2 2 2-2"/>`,
  ).join(""),
  '<path d="M12 20C9 18 4 14.5 4 9.5a4.5 4.5 0 0 1 8-2.8 4.5 4.5 0 0 1 8 2.8c0 5-5 8.5-8 10.5Z"/>',
  '<path d="M12 21V10M12 15C6 15 3 11 3 6c6 0 9 3 9 9ZM12 11c0-5 3-8 8-8 0 5-3 8-8 8Z"/>',
  '<path d="M12 8C7 1 2 7 8 12c-7 5-1 10 4 4 5 7 10 1 4-4 7-5 1-10-4-4Z"/><circle cx="12" cy="12" r="1.5"/>',
  '<path d="M5 20C1 8 8 3 20 4c1 12-4 18-15 16ZM5 20 16 9M9 16v-5m4 1h4"/>',
  '<circle cx="12" cy="12" r="4"/><path d="M12 3v2m0 14v2M3 12h2m14 0h2M5.6 5.6 7 7m10 10 1.4 1.4M5.6 18.4 7 17m10-10 1.4-1.4"/>',
  '<path d="M4 16c-4-16 20-16 16 0l-8 5-8-5ZM12 21V4M12 21 6.5 7M12 21l5.5-14"/>',
  '<path d="M10.85 4.33Q12 2.2 13.15 4.33Q14.3 6.46 16.61 5.76Q18.93 5.07 18.24 7.39Q17.54 9.7 19.67 10.85Q21.8 12 19.67 13.15Q17.54 14.3 18.24 16.61Q18.93 18.93 16.61 18.24Q14.3 17.54 13.15 19.67Q12 21.8 10.85 19.67Q9.7 17.54 7.39 18.24Q5.07 18.93 5.76 16.61Q6.46 14.3 4.33 13.15Q2.2 12 4.33 10.85Q6.46 9.7 5.76 7.39Q5.07 5.07 7.39 5.76Q9.7 6.46 10.85 4.33Z"/><circle cx="12" cy="12" r="3"/>',
  '<path d="M12 7C7 3 2 7 4 13c1.3 4.8 3 8 5.5 7.5 1.1-.2 1.4-.9 2.5-.9s1.4.7 2.5.9C17 21 18.7 17.8 20 13c2-6-3-10-8-6ZM12 7c-.5-2 .5-4 2-5m-1 3c2-3 5-2 5-2-1 3-3 4-5 2Z"/>',
  '<path d="M7 11c0 7 5 10 5 10s5-3 5-10M5 11a7 7 0 0 1 14 0H5ZM12 4l1-2M8 7l3 3m1-4 3 3"/>',
  '<path d="m12 17-8-3 3-2-2-6 5 2 2-5 2 5 5-2-2 6 3 2-8 3ZM12 21V9"/>',
  '<path d="M12 3 5.5 11h3L4 17h6v4h4v-4h6l-4.5-6h3L12 3Z"/>',
];
export function monthEmblem(month: number) {
  return emblems[month - 1] ?? emblems[0];
}
