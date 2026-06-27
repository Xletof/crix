// Shared narrative content for Crix — consumed by the intro briefing scene
// (NARRATIVE.intro), the per-room quest banners (NARRATIVE.rooms, keyed by the
// room id in rooms.js), and the victory screen (NARRATIVE.victoryLine).
//
// Kept deliberately tiny and data-driven so story can be tuned without touching
// scene logic. Theme: a Mandalorian bounty hunter infiltrating the Death Star.

export const NARRATIVE = {
  // Mission-briefing lines, typed in one-by-one on the Intro scene.
  intro: [
    'INCOMING TRANSMISSION...',
    '',
    'The Empire holds an asset aboard',
    'the Death Star. High value. Alive.',
    '',
    'Slip past the hangar patrols.',
    'Slice their terminals. Stay unseen',
    'where you can — kill where you must.',
    '',
    'One more door stands at the end.',
    'Behind it waits the Dark Lord himself.',
    '',
    'This is the Way.',
  ],

  // Per-room quest framing. `title` shows as the room's quest banner; `lore`
  // is the one-line mission-plan beat surfaced in the intro briefing.
  rooms: {
    hangar: {
      title: 'INFILTRATE THE HANGAR',
      lore: 'Breach the hangar bay and slice the control terminal.',
    },
    corridor: {
      title: 'PUSH THE CORRIDOR',
      lore: 'Fight through the service corridor — they know you are here.',
    },
    detention: {
      title: 'CRACK THE DETENTION BLOCK',
      lore: 'Slice the detention systems and free the asset.',
    },
    vader: {
      title: 'FACE THE DARK LORD',
      lore: 'Survive Vader. There is no other way out.',
    },
  },

  // Closing line on the victory screen.
  victoryLine: 'The asset is free. Vader has fallen. The Way holds.',
};
