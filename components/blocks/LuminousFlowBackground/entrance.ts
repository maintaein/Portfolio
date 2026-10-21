import { strandLane } from './geometry';

// Seconds. BootSequence raises the reveal linearly over this time; the easing lives in each strand's schedule.
export const REVEAL_SECONDS = 2.9;
// A head starts at rest and reaches its cruising speed with this time constant, then keeps going past the first screen.
const ACCELERATION = .3;

// Center lanes leave first. Delays follow the lane rank, not the lane value: lanes crowd near the edges, so
// spacing by value would send the few center strands far ahead of the rest.
const lanes = Array.from({ length: 28 }, (_, strand) => Math.abs(strandLane(strand)));
const rank = lanes.map((lane, strand) => lanes.filter((other, index) => other < lane || other === lane && index < strand).length / 27);
// crossing: seconds of cruising per first-screen path length. Later strands cruise slightly faster, so the group closes up instead of spreading.
const timing = rank.map((order, strand) => ({ delay: .12 + .45 * order, crossing: 1.7 - .25 * order + .08 * ((strand * .618034) % 1 - .5) }));

// Never below 0: just after the start, rounding would otherwise give a negative length.
const cruise = (seconds: number) => Math.max(0, seconds - ACCELERATION * (1 - Math.exp(-seconds / ACCELERATION)));

// How far strand's head has grown along the center path, in the same units as fold: the path length inside the first screen.
export const strandReach = (strand: number, progress: number, fold: number) => {
  if (progress >= 1) return Infinity;
  const { delay, crossing } = timing[strand];
  return fold * cruise(Math.max(0, progress * REVEAL_SECONDS - delay)) / crossing;
};

// The reveal at which the last head leaves the first screen: cruise(crossing + ACCELERATION) is crossing plus a sliver,
// so every head is just past the fold there.
export const HAZE_FROM = Math.max(...timing.map(({ delay, crossing }) => delay + crossing + ACCELERATION)) / REVEAL_SECONDS;
