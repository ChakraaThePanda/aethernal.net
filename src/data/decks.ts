// Archidekt deck ids. Names are what we call the deck, which isn't always the Archidekt title.
// Commander art is pulled from Archidekt's API at build time.
export interface Deck {
  name: string;
  id: number;
}

export interface Player {
  name: string;
  decks: Deck[];
  precons?: Deck[];
}

export const players: Player[] = [
  {
    name: 'Pat',
    decks: [
      { name: 'Cookies & Cream', id: 25896354 },
      { name: "Guess Who's Back?", id: 23493749 },
      { name: 'Peskipiksi Pesternomi', id: 20622633 },
      { name: 'Remember That We Once Lived', id: 16913370 },
    ],
    precons: [{ name: 'Counter Blitz', id: 25636262 }],
  },
  {
    name: 'Mimi',
    decks: [
      { name: 'Aloy vs the Machines', id: 17985803 },
      { name: 'BOY!', id: 16427411 },
      { name: 'Go to Hell!', id: 23236962 },
      { name: 'Meow Meow!', id: 12901958 },
      { name: 'Will Ferrell', id: 26222734 },
    ],
  },
  {
    name: 'Clo',
    decks: [{ name: 'Éléphants', id: 12986212 }],
    precons: [{ name: 'Endless Punishment', id: 9189744 }],
  },
  {
    name: 'Alex',
    decks: [
      { name: 'Arcades', id: 15123060 },
      { name: 'Derevi', id: 13023087 },
      { name: 'Jurassic Park', id: 16536503 },
      { name: 'Ob Nixilis (cEDH)', id: 16581084 },
    ],
    precons: [
      { name: 'Silverquill Influence', id: 21319304 },
      { name: 'Prismari Artistry', id: 21319431 },
      { name: 'Lorehold Spirit', id: 21319610 },
      { name: 'Witherbloom Pestilence', id: 21319521 },
      { name: 'Quandrix Unlimited', id: 21319716 },
      { name: 'Turtle Power!', id: 20598536 },
      { name: 'Dance of the Elements', id: 18744843 },
      { name: 'Blight Curse', id: 18744715 },
      { name: 'Counter Intelligence', id: 16580999 },
      { name: 'World Shaper', id: 16580968 },
      { name: 'Temur Roar', id: 16559137 },
      { name: 'Ahoy Mateys', id: 16559118 },
      { name: 'Veloci-Ramp-Tor', id: 16536471 },
      { name: 'Explorers of the Deep', id: 16536438 },
      { name: 'Blood Rites', id: 16559108 },
      { name: 'Virtue and Valor', id: 16581016 },
      { name: 'Elven Council', id: 4694003 },
    ],
  },
];

export const deckUrl = (id: number) => `https://archidekt.com/decks/${id}`;
