import type { EligibilityBucket, EligibilityResult } from "@/lib/api";

/** Display metadata for the three rule-based eligibility buckets returned by
 *  the backend. Ordering is stable: good news first, needs-checking second. */
export const BUCKET_ORDER: EligibilityBucket[] = [
  "potentially_eligible",
  "needs_verification",
  "not_matching",
];

export function groupByBucket(results: EligibilityResult[]): Record<EligibilityBucket, EligibilityResult[]> {
  const groups: Record<EligibilityBucket, EligibilityResult[]> = {
    potentially_eligible: [],
    needs_verification: [],
    not_matching: [],
  };
  for (const r of results) {
    if (groups[r.bucket]) groups[r.bucket].push(r);
    else groups.needs_verification.push(r); // unknown bucket is treated as needing verification
  }
  return groups;
}

export function bucketLabelKey(bucket: EligibilityBucket): "schemes.bucket.potentially_eligible" | "schemes.bucket.needs_verification" | "schemes.bucket.not_matching" {
  return bucket === "potentially_eligible"
    ? "schemes.bucket.potentially_eligible"
    : bucket === "needs_verification"
      ? "schemes.bucket.needs_verification"
      : "schemes.bucket.not_matching";
}

/** The eight questionnaire fields the eligibility check accepts. Nothing
 *  sensitive beyond these is collected. */
export const ELIGIBILITY_QUESTIONS = [
  { key: "state", label: "Which state do you live in?", type: "text" },
  { key: "age_band", label: "Your age group", type: "select", options: ["under 18", "18-25", "26-40", "41-60", "over 60"] },
  { key: "marital_status", label: "Marital status", type: "select", options: ["single", "married", "widowed", "divorced", "separated"] },
  { key: "social_category", label: "Social category", type: "select", options: ["general", "sc", "st", "obc", "minority"] },
  { key: "income_band", label: "Yearly family income", type: "select", options: ["below 1 lakh", "1-2.5 lakh", "2.5-5 lakh", "above 5 lakh"] },
  { key: "occupation", label: "Occupation", type: "select", options: ["student", "homemaker", "agriculture", "self-employed", "salaried", "unemployed"] },
  { key: "disability", label: "Do you have a disability?", type: "select", options: ["no", "yes"] },
  { key: "housing", label: "Housing", type: "select", options: ["owned", "rented", "homeless"] },
] as const;
