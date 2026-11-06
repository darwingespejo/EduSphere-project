// Camera presets. az = azimuth in degrees around the robot (0 = front, 90 = robot's left),
// el = elevation in degrees, d = distance multiplier, ty/tz = look-at height/depth override.
export const VIEWS = [
  { id: 'front', n: 'Front', az: 0, el: 6, d: 1.0 },
  { id: 'l34', n: '¾ Left', az: 38, el: 13, d: 1.0 },
  { id: 'left', n: 'Left', az: 90, el: 6, d: 1.0 },
  { id: 'back', n: 'Back', az: 180, el: 8, d: 1.0 },
  { id: 'right', n: 'Right', az: -90, el: 6, d: 1.0 },
  { id: 'r34', n: '¾ Right', az: -38, el: 13, d: 1.0 },
  { id: 'top', n: 'Top', az: 0, el: 84, d: 1.05, lab: 'el 84°' },
  { id: 'low', n: 'Low', az: 14, el: 1.5, d: 0.9, lab: 'el 2°' },
  { id: 'face', n: 'Close-up', az: 18, el: 4, d: 0.58, ty: 3.5, tz: 0.4, lab: '×1.7' },
];

export const viewLabel = (v) => v.lab || `${(v.az + 360) % 360}°`;

export const GLOWS = [
  { n: 'Cyan', c: '#35e6ff' },
  { n: 'Violet', c: '#a78bff' },
  { n: 'Lime', c: '#9dff5a' },
  { n: 'Amber', c: '#ffb347' },
  { n: 'Rose', c: '#ff5fa2' },
];
