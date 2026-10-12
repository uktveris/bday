// Text for each stop, in journey order.
// - letter: `title` and `text` are written on a big sheet of paper. Separate
//   paragraphs with a blank line; the type shrinks to fit, so shorter letters
//   get bigger, more readable text.
// - watermelon: `title` and `text` are printed onto the fruit and wrapped to
//   its shape.
// - throne: `title` is spelled out in crystals, so keep it to a few short words.
// - table: uses `apronTexts`, `lightText` and `bookTitle`.
// The throne and table can also have a `note`: a paper sheet floating beside
// them. `button` is the label of the button under each stop; `voidColor` is
// the background while parked there.
export const FRUITS = [
  {
    kind: 'letter',
    voidColor: '#000000', // black
    accent: '#ffe2a8',
    title: 'Labas;)',
    text: `kadangi siandien tavo gimtadienis ir mes nesame kartu, nusprendziau padovanoti biski kitokia dovana:D cia keletas random dalyku, bet turetu buti VISAI juokinga. LABAI sveikinu tave su gimtadieniu (pagaliau busim tokio pacio amziaus hehe), ir neitiketinai dziaugiuosi kad tave pazistu!! (Cia pirma puse mano dovanos:D)`,
    button: 'Toliau',
  },
  {
    kind: 'watermelon',
    voidColor: '#0c2a12', // dark green
    accent: '#7ed957',
    title: 'Arbuzas',
    text: 'Dovanoju virtualu arbuza, kuri visada galesi tureti ir ziureti, bet nevalgyti ;)',
    button: 'Toliau',
  },
  {
    kind: 'throne',
    voidColor: '#6e1f4c', // pink
    accent: '#ff7ac0',
    title: 'Juicy Queen',
    text: '',
    // Written on the paper note that floats beside the throne.
    note: "O cia tavo sostas, tikiuosi geresnis nei tas mano rodytas",
    button: 'Toliau',
  },
  {
    kind: 'table',
    voidColor: '#2a1050', // violet
    accent: '#ff7ac0',
    // Not shown on the table (read out to screen readers only).
    title: 'You made it!',
    text: 'Thanks for flying with us.',
    // Crystal text on each plank between the legs: front, right, back, left.
    // The table slowly turns, so all four come round to the front.
    apronTexts: ['Deimantė', 'Juicy', 'Couture', 'Always & forever'],
    // Glowing text projected onto the platform by the light under the top.
    lightText: 'Stay Juicy',
    // Gold-foil title on the black book in the glass case on top of the table.
    bookTitle: 'Vėtrų kalnas',
    // The book starts hidden behind curtains; this is written on the paper
    // note that floats beside the table.
    note: 'Paspausk and uzuolaidu',
    button: 'Cia spausk jei pavargai ziureti i sita dalyka',
  },
];
