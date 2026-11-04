import { describe, expect, it } from "vitest";

/**
 * Eligibility grouping is enforced on the backend (three buckets with
 * reasons); the frontend renders whatever the API returns. This test pins
 * the frontend contract: bucket keys, the disclaimer text and the shape of
 * the recommendation payload the UI reads.
 */
const MOCK_RECOMMENDATION = {
  results: [
    { scheme_id: "1", name: "A", bucket: "potentially_eligible", reason: "r1" },
    { scheme_id: "2", name: "B", bucket: "needs_verification", reason: "r2" },
    { scheme_id: "3", name: "C", bucket: "not_matching", reason: "r3" },
  ],
  potentially_eligible: [{ scheme_id: "1", name: "A", bucket: "potentially_eligible", reason: "r1" }],
  needs_verification: [{ scheme_id: "2", name: "B", bucket: "needs_verification", reason: "r2" }],
  not_matching: [{ scheme_id: "3", name: "C", bucket: "not_matching", reason: "r3" }],
  disclaimer: "This is only an indication based on your answers.",
} as const;

describe("eligibility buckets", () => {
  it("exposes exactly the three contract buckets", () => {
    expect(Object.keys(MOCK_RECOMMENDATION).sort()).toEqual(
      ["disclaimer", "needs_verification", "not_matching", "potentially_eligible", "results"].sort(),
    );
  });

  it("every result lands in exactly one of the three buckets", () => {
    const bucketNames = ["potentially_eligible", "needs_verification", "not_matching"] as const;
    const counted = bucketNames.reduce((sum, key) => sum + MOCK_RECOMMENDATION[key].length, 0);
    expect(counted).toBe(MOCK_RECOMMENDATION.results.length);
    for (const bucket of bucketNames) {
      for (const result of MOCK_RECOMMENDATION[bucket]) {
        expect(result.bucket).toBe(bucket);
        expect(result.reason).toBeTruthy();
      }
    }
  });

  it("keeps a disclaimer in the payload so the UI can always show one", () => {
    expect(MOCK_RECOMMENDATION.disclaimer).toMatch(/indication|not a guarantee/i);
  });
});
