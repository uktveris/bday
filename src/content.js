// Text for each stop, in journey order. On the fruits, `title` and `text` are
// printed onto the fruit and auto-wrapped to its shape (shorter text = bigger
// letters). On the throne, only `title` is used: it's spelled out in crystals,
// so keep it to a few short words.
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
    button: 'Fly to the strawberry',
  },
  {
    kind: 'strawberry',
    name: 'Strawberry',
    accent: '#ff5f8f',
    kicker: 'Stop 4 of 4',
    title: 'You made it!',
    text: 'A sweet little end to the journey. Thanks for flying with us.',
    button: 'Start the journey again',
  },
];
