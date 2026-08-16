/** ponytail self-check for polishDemoMetrics. Run: node --experimental-strip-types scripts/check-demo-metrics.mjs */
import { polishDemoMetrics } from "../src/lib/demo-metrics.ts";

const low = polishDemoMetrics({
  views: 368,
  likes: 20,
  comments: 3,
  followers: 8000,
  seed: "check-low",
});
const high = polishDemoMetrics({
  views: 67000,
  likes: 1562,
  comments: 40,
  followers: 200000,
  seed: "check-high",
});

if (!(low.views >= 18_000 && low.views < high.views)) {
  throw new Error(`rank broken: low=${low.views} high=${high.views}`);
}
if (!(high.views <= 920_000 && high.likes > 0 && high.comments > 0)) {
  throw new Error(`cap/engagement broken: ${JSON.stringify(high)}`);
}

console.log("ok", { lowViews: low.views, highViews: high.views });
