// Built-in backgrounds.
//
// These are the reading-room and desk photographs that ship with the app, taken
// from the two artwork sheets in the repository. They live beside the code as
// ordinary JPEGs so the service worker can cache them and the Android build can
// serve them offline, and each one is at least 800 px on its short edge so it
// satisfies the same rules as a picture the reader uploads.

import study from "./assets/backgrounds/room-study.jpg?url";
import lantern from "./assets/backgrounds/room-lantern.jpg?url";
import armchair from "./assets/backgrounds/room-armchair.jpg?url";
import corridor from "./assets/backgrounds/room-corridor.jpg?url";
import paper from "./assets/backgrounds/room-paper.jpg?url";
import night from "./assets/backgrounds/room-night.jpg?url";
import lounge from "./assets/backgrounds/room-lounge.jpg?url";
import candles from "./assets/backgrounds/room-candles.jpg?url";
import velvet from "./assets/backgrounds/room-velvet.jpg?url";
import deskOak from "./assets/backgrounds/desk-oak.jpg?url";
import deskHoney from "./assets/backgrounds/desk-honey.jpg?url";

export const BUILTIN_ARTWORK = [
  {
    id: "builtin-study",
    surface: "home",
    name: "Study window",
    dataUrl: study,
    width: 800,
    height: 800,
  },
  {
    id: "builtin-lantern",
    surface: "home",
    name: "Lantern stacks",
    dataUrl: lantern,
    width: 1196,
    height: 860,
  },
  {
    id: "builtin-armchair",
    surface: "home",
    name: "Armchair and ladder",
    dataUrl: armchair,
    width: 800,
    height: 800,
  },
  {
    id: "builtin-corridor",
    surface: "home",
    name: "Long corridor",
    dataUrl: corridor,
    width: 1024,
    height: 1011,
  },
  {
    id: "builtin-paper",
    surface: "home",
    name: "Aged paper",
    dataUrl: paper,
    width: 1216,
    height: 860,
  },
  {
    id: "builtin-night",
    surface: "home",
    name: "Night stacks",
    dataUrl: night,
    width: 1024,
    height: 576,
  },
  {
    id: "builtin-lounge",
    surface: "home",
    name: "Reading lounge",
    dataUrl: lounge,
    width: 1312,
    height: 736,
  },
  {
    id: "builtin-candles",
    surface: "home",
    name: "Candlelit stacks",
    dataUrl: candles,
    width: 1529,
    height: 860,
  },
  {
    id: "builtin-velvet",
    surface: "home",
    name: "Velvet curtain",
    dataUrl: velvet,
    width: 860,
    height: 1800,
  },
  {
    id: "builtin-desk-oak",
    surface: "reader",
    name: "Dark oak desk",
    dataUrl: deskOak,
    width: 941,
    height: 1672,
  },
  {
    id: "builtin-desk-honey",
    surface: "reader",
    name: "Honey wood desk",
    dataUrl: deskHoney,
    width: 1003,
    height: 1500,
  },
];

export const builtinFor = (surface) =>
  BUILTIN_ARTWORK.filter((art) => art.surface === surface);
