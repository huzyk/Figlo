// Custom 64×64 inline SVG motifs. Constant authored markup, no user input and no external image requests.
// Maintain a single monoline system so every pack looks like one PUZLI family.
export const ART = Object.freeze({
  atom: {
    label: 'atom', color: '#8064d8',
    art: '<ellipse cx="32" cy="32" rx="26" ry="10"/><ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(60 32 32)"/><ellipse cx="32" cy="32" rx="26" ry="10" transform="rotate(120 32 32)"/><circle cx="32" cy="32" r="4.5" fill="currentColor" stroke="none"/>'
  },
  dna: {
    label: 'DNA', color: '#389a9e',
    art: '<path d="M19 7 C51 17 51 25 19 32 S-13 48 45 57"/><path d="M45 7 C13 17 13 25 45 32 S77 48 19 57"/><path d="M23 13h18M31 20h2M17 32h30M31 44h2M23 51h18" stroke-width="2.5"/>'
  },
  brain: {
    label: 'mózg', color: '#d35b92',
    art: '<path d="M31 14C22 6 12 14 13 23C6 27 7 39 15 41C12 50 21 57 30 51L31 14Z"/><path d="M33 14C42 6 52 14 51 23C58 27 57 39 49 41C52 50 43 57 34 51L33 14Z"/><path d="M19 23c9 0 9 8 6 11M15 41c5-4 10-3 12 3M45 23c-9 0-9 8-6 11M49 41c-5-4-10-3-12 3"/><path d="M32 13v41" stroke-width="2"/>'
  },
  volcano: {
    label: 'wulkan', color: '#ce654d',
    art: '<path d="M6 54h52L42 28l-8 10-10-10L6 54Z" fill="currentColor" fill-opacity=".16"/><path d="M6 54h52L42 28l-8 10-10-10L6 54Z"/><path d="M23 27c7 5 15 5 20 0M32 22l-3-7m8 7 4-9m-10-5-1-4m-10 10-5-6"/><path d="M32 40v14" stroke-width="2"/>'
  },
  saturn: {
    label: 'Saturn', color: '#9c7e40',
    art: '<circle cx="32" cy="32" r="15" fill="currentColor" fill-opacity=".14"/><circle cx="32" cy="32" r="15"/><ellipse cx="32" cy="32" rx="29" ry="10" transform="rotate(-24 32 32)"/><path d="M20 26c7 3 15 3 23-1" stroke-width="2"/><path d="M24 40c6 2 13 2 18-1" stroke-width="2"/>'
  },
  crystal: {
    label: 'kryształ', color: '#527ab6',
    art: '<path d="M21 9h22l13 17-24 30L8 26 21 9Z" fill="currentColor" fill-opacity=".10"/><path d="M21 9h22l13 17-24 30L8 26 21 9Z"/><path d="M8 26h48M21 9l-5 17 16 30 16-30-5-17M16 26h32"/>'
  },
  snowflake: {
    label: 'płatek śniegu', color: '#3a98c9',
    art: '<path d="M32 5v54M5 32h54M13 13l38 38M51 13 13 51"/><path d="m25 12 7 7 7-7M25 52l7-7 7 7M12 25l7 7-7 7M52 25l-7 7 7 7M16 11v10h10M48 11v10H38M16 53V43h10M48 53V43H38" stroke-width="2.5"/>'
  },
  magnet: {
    label: 'magnes', color: '#d27752',
    art: '<path d="M16 9h12v27a4 4 0 0 0 8 0V9h12v27a16 16 0 0 1-32 0V9Z" fill="currentColor" fill-opacity=".10"/><path d="M16 9h12v27a4 4 0 0 0 8 0V9h12v27a16 16 0 0 1-32 0V9Z"/><path d="M16 19h12M36 19h12" stroke-width="4"/>'
  },

  // Ziemia i kosmos — large distinctive silhouettes, never color-only differences.
  earth: {label:'Ziemia',color:'#277e9d',art:'<circle cx="32" cy="32" r="25"/><path d="M24 10l-5 11 8 7-2 10-9 4-3-9M35 8l7 7-2 8 11 5-5 13-8 3-5 12M36 29l-9 5 8 6 5-6 9-3" fill="currentColor" fill-opacity=".12"/><path d="M24 10l-5 11 8 7-2 10-9 4-3-9M35 8l7 7-2 8 11 5-5 13-8 3-5 12M36 29l-9 5 8 6 5-6 9-3"/>'},
  moon: {label:'Księżyc',color:'#7266ab',art:'<path d="M43 6C25 10 19 24 25 38s21 15 30 7C48 57 30 61 18 49 4 36 9 14 26 7c6-2 12-2 17-1Z" fill="currentColor" fill-opacity=".12"/><path d="M43 6C25 10 19 24 25 38s21 15 30 7C48 57 30 61 18 49 4 36 9 14 26 7c6-2 12-2 17-1Z"/><circle cx="20" cy="18" r="2" stroke="none" fill="currentColor"/>'},
  rocket: {label:'rakieta',color:'#cb6674',art:'<path d="M27 43C20 31 25 14 42 5c8 16 2 32-10 39l-5-1Z" fill="currentColor" fill-opacity=".12"/><path d="M27 43C20 31 25 14 42 5c8 16 2 32-10 39l-5-1ZM26 36l-12 4-7 12 16-5M35 43l-2 12-10 5 4-17"/><circle cx="37" cy="22" r="5"/><path d="M20 49l-9 10M24 50l-4 10"/>'},
  comet: {label:'kometa',color:'#b267c8',art:'<path d="M9 48C22 34 29 27 40 24M5 37c15-9 23-12 35-13M17 57c5-15 14-27 23-33"/><path d="M50 15l7 6-2 10-10 5-9-7 2-10 12-4Z" fill="currentColor" fill-opacity=".14"/><path d="M50 15l7 6-2 10-10 5-9-7 2-10 12-4Z"/>'},
  galaxy: {label:'galaktyka',color:'#8c60c0',art:'<path d="M10 30c5-19 29-27 43-13 10 11 3 28-11 31-15 4-24-6-20-16 3-8 15-10 20-4 4 5 1 11-5 12-5 1-8-2-8-5"/><path d="m49 8 1 7 7 2-7 2-1 7-2-7-7-2 7-2 2-7Z" fill="currentColor" stroke="none"/>'},
  sun: {label:'Słońce',color:'#bf7b25',art:'<circle cx="32" cy="32" r="15" fill="currentColor" fill-opacity=".13"/><circle cx="32" cy="32" r="15"/><path d="M32 2v9m0 42v9M2 32h9m42 0h9M11 11l7 7m28 28 7 7M53 11l-7 7M18 46l-7 7" stroke-width="4"/>'},
  star: {label:'gwiazda',color:'#ac7732',art:'<path d="M32 5 40 23 60 25 45 39 49 59 32 49 15 59 19 39 4 25 24 23 32 5Z" fill="currentColor" fill-opacity=".13"/><path d="M32 5 40 23 60 25 45 39 49 59 32 49 15 59 19 39 4 25 24 23 32 5Z"/>'},
  telescope: {label:'teleskop',color:'#387d89',art:'<path d="M11 17l31-9 8 16-32 12-7-19Z" fill="currentColor" fill-opacity=".12"/><path d="M11 17l31-9 8 16-32 12-7-19ZM9 21l-5 2 6 14 7-3-8-13ZM45 26l6 6M32 35v7m0 0-15 17m15-17 17 17m-17-17v17"/><circle cx="32" cy="39" r="3" fill="currentColor" stroke="none"/>'},

  // Umysł i logika — immediately nameable icons for fast visual encoding.
  eye: {label:'oko',color:'#4d7f9f',art:'<path d="M5 32c8-12 17-18 27-18s19 6 27 18c-8 12-17 18-27 18S13 44 5 32Z"/><circle cx="32" cy="32" r="10" fill="currentColor" fill-opacity=".12"/><circle cx="32" cy="32" r="10"/><circle cx="32" cy="32" r="4" fill="currentColor" stroke="none"/>'},
  maze: {label:'labirynt',color:'#8163af',art:'<path d="M6 25V6h52v52H6V39M16 15h33v33H16V24h23v15H25v-6h7M6 46h12m31-23h9" stroke-width="4"/>'},
  puzzle: {label:'puzel',color:'#6586b5',art:'<path d="M10 10h15c-1 9 14 9 13 0h16v17c-9-2-9 13 0 12v15H38c2-9-13-9-13 0H10V38c9 1 9-13 0-11V10Z" fill="currentColor" fill-opacity=".12"/><path d="M10 10h15c-1 9 14 9 13 0h16v17c-9-2-9 13 0 12v15H38c2-9-13-9-13 0H10V38c9 1 9-13 0-11V10Z"/>'},
  target: {label:'tarcza',color:'#b46d50',art:'<circle cx="32" cy="32" r="25"/><circle cx="32" cy="32" r="16"/><circle cx="32" cy="32" r="7" fill="currentColor" fill-opacity=".15"/><path d="M32 2v9m0 42v9M2 32h9m42 0h9"/>'},
  hourglass: {label:'klepsydra',color:'#ac703c',art:'<path d="M14 7h36M14 57h36M18 9c0 13 10 14 14 23-4 9-14 10-14 23h28c0-13-10-14-14-23 4-9 14-10 14-23H18Z" fill="currentColor" fill-opacity=".10"/><path d="M14 7h36M14 57h36M18 9c0 13 10 14 14 23-4 9-14 10-14 23h28c0-13-10-14-14-23 4-9 14-10 14-23H18Z"/><path d="M26 46h12l-6-9-6 9Z" fill="currentColor" stroke="none"/>'},
  key: {label:'klucz',color:'#8870ae',art:'<circle cx="20" cy="20" r="13"/><circle cx="20" cy="20" r="5"/><path d="M30 30l26 26m-8-8 7-7m-16-2 7-7" stroke-width="5"/>'},
  bulb: {label:'żarówka',color:'#b08230',art:'<path d="M22 42C11 34 14 16 26 11c15-6 30 6 26 21-2 6-8 9-10 14H23l-1-4Z" fill="currentColor" fill-opacity=".10"/><path d="M22 42C11 34 14 16 26 11c15-6 30 6 26 21-2 6-8 9-10 14H23l-1-4ZM23 49h19m-17 7h15m-13 4h11M26 29l6 6 6-6m-6 6v11"/>'},
  knight: {label:'skoczek',color:'#6e73ad',art:'<path d="M19 55h34v5H12v-5h7ZM19 55c1-9-4-13-4-21l-7 3-3-10 9-10 5-10 7 6 11-2c1 12 4 17 10 28l-3 16H19Z" fill="currentColor" fill-opacity=".10"/><path d="M19 55h34v5H12v-5h7ZM19 55c1-9-4-13-4-21l-7 3-3-10 9-10 5-10 7 6 11-2c1 12 4 17 10 28l-3 16H19Z"/><circle cx="23" cy="21" r="3" fill="currentColor" stroke="none"/>'},

  // Natura jako wzór — eight unmistakable silhouettes.
  leaf: {label:'liść',color:'#458b62',art:'<path d="M10 52C8 28 20 11 57 7 54 37 38 56 10 52Z" fill="currentColor" fill-opacity=".13"/><path d="M10 52C8 28 20 11 57 7 54 37 38 56 10 52Z"/><path d="M9 55 45 19M24 40l-3-18m13 7 16 2"/>'},
  shell: {label:'muszla',color:'#ad765d',art:'<path d="M15 54C1 41 8 17 29 11c26-7 41 13 28 30-8 10-27 16-42 13Z" fill="currentColor" fill-opacity=".11"/><path d="M15 54C1 41 8 17 29 11c26-7 41 13 28 30-8 10-27 16-42 13Z"/><path d="M15 54c-4-21 9-35 25-34 17 1 19 22 7 26-11 4-18-6-12-13 5-5 11-1 9 3"/>'},
  honeycomb: {label:'plaster miodu',color:'#ad8535',art:'<path d="m23 4 10 6v12l-10 6-10-6V10l10-6Zm20 0 10 6v12l-10 6-10-6V10l10-6Zm-20 24 10 6v12l-10 6-10-6V34l10-6Zm20 0 10 6v12l-10 6-10-6V34l10-6ZM33 22l10 6m-20 0 10-6"/>'},
  lightning: {label:'piorun',color:'#ac7d20',art:'<path d="M36 4 12 36h20l-5 24 26-36H33l3-20Z" fill="currentColor" fill-opacity=".13"/><path d="M36 4 12 36h20l-5 24 26-36H33l3-20Z"/>'},
  mountain: {label:'góry',color:'#6f87a1',art:'<path d="m4 54 21-38 13 20 8-13 14 31H4Z" fill="currentColor" fill-opacity=".12"/><path d="m4 54 21-38 13 20 8-13 14 31H4ZM17 31l8 7 6-7M41 33l5 5 4-5"/>'},
  tree: {label:'drzewo',color:'#43865e',art:'<path d="M31 47V60m0-15-12 7M31 48l14 4"/><path d="M31 6 17 22h6L11 38h11l-8 11h35l-8-11h11L40 22h6L31 6Z" fill="currentColor" fill-opacity=".13"/><path d="M31 6 17 22h6L11 38h11l-8 11h35l-8-11h11L40 22h6L31 6Z"/>'},
  droplet: {label:'kropla',color:'#347cb5',art:'<path d="M32 5C26 19 13 33 13 43a19 19 0 0 0 38 0C51 33 38 19 32 5Z" fill="currentColor" fill-opacity=".13"/><path d="M32 5C26 19 13 33 13 43a19 19 0 0 0 38 0C51 33 38 19 32 5Z"/><path d="M22 40c0 8 4 12 11 13" stroke-width="2.5"/>'},
  flower: {label:'kwiat',color:'#b8658c',art:'<circle cx="32" cy="16" r="10" fill="currentColor" fill-opacity=".10"/><circle cx="47" cy="24" r="10" fill="currentColor" fill-opacity=".10"/><circle cx="47" cy="41" r="10" fill="currentColor" fill-opacity=".10"/><circle cx="32" cy="49" r="10" fill="currentColor" fill-opacity=".10"/><circle cx="17" cy="41" r="10" fill="currentColor" fill-opacity=".10"/><circle cx="17" cy="24" r="10" fill="currentColor" fill-opacity=".10"/><circle cx="32" cy="32" r="8" fill="currentColor" fill-opacity=".3"/>'},

});
