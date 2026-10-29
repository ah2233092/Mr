// Geometry shared between scenes so elements can hand off seamlessly.

// Scene 4: the five service medallions in a row
export const ROW = {y: 560, size: 150, gap: 70};
export const rowX = (i: number) => 960 + (i - 2) * (ROW.size + ROW.gap);

// Scene 5: left-third title panel
export const PANEL = {x: 120, iconY: 300, iconSize: 150, titleY: 486, subY: 612, progY: 214};

// Scene 5 → 6: the A+ "Buy now" button (screen coordinates) the ripple grows from
export const BUY_BTN = {x: 1590, y: 352};
