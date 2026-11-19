import { timeAgo } from "../time";

const now = new Date("2026-11-18T12:00:00Z");
const ago = (s: number) => new Date(now.getTime() - s * 1000);

it.each([
  [2, "just now"],
  [12, "12 s ago"],
  [180, "3 min ago"],
  [7200, "2 h ago"],
  [3 * 86400, "3 d ago"],
  [16 * 86400, "Nov 2"],
  [400 * 86400, "Oct 14, 2025"],
  [-30, "just now"],
])("%s seconds → %s", (seconds, expected) => {
  expect(timeAgo(ago(seconds), now)).toBe(expected);
});
