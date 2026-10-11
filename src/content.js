// Text for each stop, in journey order. On the fruits, `title` and `text` are
// printed onto the fruit and auto-wrapped to its shape (shorter text = bigger
// letters). On the throne, only `title` is used: it's spelled out in crystals,
// so keep it to a few short words. The table uses `apronTexts`, `lightText`
// and `bookTitle`.
// `kicker` and `button` appear in the bar below.
export const FRUITS = [
  {
    kind: 'watermelon',
    name: 'Watermelon',
    accent: '#7ed957',
    kicker: 'Stop 1 of 4',
    title: 'Hello, traveller',
    text: 'Your journey starts with the biggest, juiciest giant of them all. Buckle up!',
    button: 'Fly to the throne',
  },
  {
    kind: 'throne',
    name: 'Throne',
    accent: '#ff7ac0',
    kicker: 'Stop 2 of 4',
    title: 'Juicy Queen',
    text: '',
    button: 'Fly to the apple',
  },
  {
    kind: 'apple',
    name: 'Apple',
    accent: '#ff4d5e',
    kicker: 'Stop 3 of 4',
    title: 'A crisp red world',
    text: 'An apple floating in the void. It keeps the doctor away, wherever you are.',
    button: 'Fly to the table',
  },
  {
    kind: 'table',
    name: 'Table',
    accent: '#ff7ac0',
    kicker: 'Stop 4 of 4',
    // Not shown on the table (read out to screen readers only).
    title: 'You made it!',
    text: 'Thanks for flying with us.',
    // Crystal text on each plank between the legs: front, right, back, left.
    // The table slowly turns, so all four come round to the front.
    apronTexts: ['You made it!', 'So fabulous', 'Pure glam', 'Sweet dreams'],
    // Glowing text projected onto the platform by the light under the top.
    lightText: 'Stay Juicy',
    // Gold-foil title on the black book in the glass case on top of the table.
    bookTitle: 'Juicy Secrets',
    // The book starts hidden behind curtains; this hint shows at this stop.
    hint: 'Psst, tap the curtains',
    button: 'Start the journey again',
  },
];
