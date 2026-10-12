// Text for each stop, in journey order.
// - letter: `title` and `text` are written on a big sheet of paper. Separate
//   paragraphs with a blank line; the type shrinks to fit, so shorter letters
//   get bigger, more readable text.
// - watermelon: `title` and `text` are printed onto the fruit and wrapped to
//   its shape.
// - throne: `title` is spelled out in crystals, so keep it to a few short words.
// - table: uses `apronTexts`, `lightText` and `bookTitle`.
// The throne and table can also have a `note`: a paper sheet floating beside
// them. `kicker` and `button` appear in the bar below; `voidColor` is the
// background while parked at that stop.
export const FRUITS = [
  {
    kind: 'letter',
    voidColor: '#3a080c', // dark red
    name: 'Letter',
    accent: '#ffe2a8',
    kicker: 'Stop 1 of 4',
    title: 'Dear traveller,',
    text: `If you are reading this, you have drifted a very long way from anywhere sensible, and that is exactly where the good things are kept.

Ahead of you, floating in the dark, are a few treasures we have been saving. There is a watermelon of quite unreasonable size. There is a throne that is far too pink and knows it. And at the very end there is a small table with a secret on top, hidden behind velvet curtains.

A few words of advice before you go. Everything out here can be tapped, and most things enjoy it. You can drag to look around, though nothing will let you peek underneath. If a piece of paper tells you to do something, it is probably right.

Take your time. There is no hurry in the void.

When you are ready, press the button below, and hold on to something soft.`,
    button: 'Fly to the watermelon',
  },
  {
    kind: 'watermelon',
    voidColor: '#0c2a12', // dark green
    name: 'Watermelon',
    accent: '#7ed957',
    kicker: 'Stop 2 of 4',
    title: 'A juicy giant',
    text: 'The biggest, juiciest watermelon this side of anywhere. Go on, give it a poke.',
    button: 'Fly to the throne',
  },
  {
    kind: 'throne',
    voidColor: '#6e1f4c', // pink
    name: 'Throne',
    accent: '#ff7ac0',
    kicker: 'Stop 3 of 4',
    title: 'Juicy Queen',
    text: '',
    // Written on the paper note that floats beside the throne.
    note: "Do not sit. Unless you're fabulous.",
    button: 'Fly to the table',
  },
  {
    kind: 'table',
    voidColor: '#2a1050', // violet
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
    // The book starts hidden behind curtains; this is written on the paper
    // note that floats beside the table.
    note: 'Psst... tap the curtains!',
    button: 'Start the journey again',
  },
];
