import { timeAgo } from "../time";

const now = new Date("2026-11-18T12:00:00Z");
const ago = (s: number) => new Date(now.getTime() - s * 1000);

it.each([
  [2, "just now"],
  [12, "12 s ago"],
  [180, "3 min ago"],
  [7200, "2 h ago"],
  [-30, "just now"],
])("%s seconds → %s", (seconds, expected) => {
  expect(timeAgo(ago(seconds), now)).toBe(expected);
});
