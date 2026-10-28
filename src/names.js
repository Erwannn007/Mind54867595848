// Petits noms poétiques pour les lieux découverts.

const START = ['Lu', 'Mi', 'Sé', 'Va', 'Or', 'Né', 'Bru', 'Ly', 'Ca', 'Fen', 'Ro', 'Al', 'Ève', 'Ma', 'Sol', 'Lin', 'Thé', 'Bel'];
const MID = ['', '', 'ri', 'la', 'mé', 'no', 'ven', 'li', 'sa', 'do'];
const END = ['ne', 'ria', 'mont', 'bel', 'lys', 'val', 'ore', 'line', 'brune', 'sée', 'lune', 'mie', 'rose', 'ciel'];

export function placeName(r) {
  const a = Math.floor(r * 7919) % START.length;
  const b = Math.floor(r * 104729) % MID.length;
  const c = Math.floor(r * 1299709) % END.length;
  return START[a] + MID[b] + END[c];
}
