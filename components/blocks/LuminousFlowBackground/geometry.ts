export type FlowPoint = { x: number; y: number; halfWidth: number; s: number };
export type FlowGeometry = {
  width: number; height: number; length: number;
  center: readonly FlowPoint[];
  strands: readonly (readonly (readonly FlowPoint[])[])[]; // strand → 16 poses → samples
};

// x, y, half-width in a 492 x 2162 design space: broad pools alternate with narrow, luminous turns.
const anchors = [
  [540, -50, 48], [342, 65, 24], [251, 112, 55], [178, 219, 2],
  [282, 267, 37], [390, 410, 67], [295, 535, 23], [85, 635, 76],
  [32, 710, 3], [202, 818, 72], [348, 970, 26], [468, 1130, 65],
  [453, 1230, 4], [249, 1350, 79], [38, 1493, 3], [214, 1602, 58],
  [424, 1715, 24], [463, 1792, 47], [294, 1870, 54], [110, 1860, 20],
  [-40, 1925, 38],
];
const constrictions = [-3, 3, 8, 12, 14, 17, 24];

// The spline is sampled once in design space; a document size only rescales its axes.
const design = anchors.slice(0, -1).flatMap((anchor, segment) => {
  const previous = anchors[Math.max(segment - 1, 0)];
  const next = anchors[segment + 1];
  const after = anchors[Math.min(segment + 2, anchors.length - 1)];
  return Array.from({ length: segment === anchors.length - 2 ? 7 : 6 }, (_, step) => {
    const t = step / 6;
    const controls = [previous, anchor, next, after];
    // A cubic B-spline keeps position, tangent and curvature continuous at knots.
    const basis = [(1 - t) ** 3, 3 * t ** 3 - 6 * t * t + 4, -3 * t ** 3 + 3 * t * t + 3 * t + 1, t ** 3];
    const coordinates = [0, 1].map(axis => controls.reduce((sum, point, index) => sum + point[axis] * basis[index] / 6, 0));
    const velocity = [-.5 * (1 - t) ** 2, 1.5 * t * t - 2 * t, -1.5 * t * t + t + .5, .5 * t * t];
    const acceleration = [1 - t, 3 * t - 2, 1 - 3 * t, t];
    const derivative = [0, 1].map(axis => controls.reduce((sum, point, index) => sum + point[axis] * velocity[index], 0));
    const bend = [0, 1].map(axis => controls.reduce((sum, point, index) => sum + point[axis] * acceleration[index], 0));
    // One broad, smooth fan between turns, rather than a bump at every anchor.
    const position = segment + t;
    const interval = constrictions.findIndex((knot, index) => index > 0 && knot >= position);
    const start = constrictions[interval - 1], end = constrictions[interval];
    const progress = (position - start) / (end - start);
    const peak = Math.max(...anchors.slice(Math.max(0, start), Math.min(anchors.length, end + 1)).map(point => point[2])) * 1.35 * Math.min(1, (end - start) / 3);
    const width = 2 + (peak - 2) * 64 * progress ** 3 * (1 - progress) ** 3;
    return { coordinates, derivative, bend, width };
  });
});

// Ripples keep their place along the design path, so poses line up with the same center samples at any size.
let distance = 0;
const distances = design.map(({ coordinates: [x, y] }, index) => {
  if (index) distance += Math.hypot(x - design[index - 1].coordinates[0], y - design[index - 1].coordinates[1]);
  return distance;
});

// Only the inside of a turn needs a curvature limit; outer branches can fan out.
export const normalOffset = (offset: number, curvature: number, limit: number) => offset / Math.sqrt(1 + (Math.max(0, offset * curvature) / limit) ** 2);

export function buildFlowGeometry(width: number, height: number): FlowGeometry {
  const scale = [width / 492, height / 2162];
  // Widths follow the horizontal scale only: a taller document lengthens the path, never the energy.
  const frames = design.map(({ coordinates, derivative, bend, width: designWidth }) => {
    const [x, y] = coordinates.map((value, axis) => value * scale[axis]);
    const [dx, dy] = derivative.map((value, axis) => value * scale[axis]);
    const [ax, ay] = bend.map((value, axis) => value * scale[axis]);
    const speed = Math.hypot(dx, dy) || 1; // A zero-size box has no direction.
    return { x, y, halfWidth: designWidth * scale[0], nx: -dy / speed, ny: dx / speed, curvature: (dx * ay - dy * ax) / speed ** 3 };
  });
  let length = 0;
  const center = frames.map(({ x, y, halfWidth }, index) => {
    if (index) length += Math.hypot(x - frames[index - 1].x, y - frames[index - 1].y);
    return { x, y, halfWidth, s: length };
  });
  const strands = Array.from({ length: 28 }, (_, index) => {
    const phase = index * 2.399963;
    const lane = Math.sin(phase) * .73;
    return Array.from({ length: 16 }, (_, frame) => {
      const clock = frame / 16 * Math.PI * 2;
      return frames.map(({ x, y, halfWidth, nx, ny, curvature }, sample) => {
        const travel = distances[sample];
        const wanderingLane = lane + Math.sin(travel * .007 + phase - clock) * .28
          + Math.sin(travel * .003 + phase * .7 + clock) * .18;
        const ripple = (Math.sin(travel * (.014 + index % 5 * .001) + phase - clock * 2) * 3
          + Math.sin(travel * .009 + index * .7 - clock) * 5) * halfWidth / 35;
        const offset = normalOffset(wanderingLane * halfWidth + ripple, curvature, .2);
        return { x: x + nx * offset, y: y + ny * offset, halfWidth, s: center[sample].s };
      });
    });
  });
  return { width, height, length, center, strands };
}
