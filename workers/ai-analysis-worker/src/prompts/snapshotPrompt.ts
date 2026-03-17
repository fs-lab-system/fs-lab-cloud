import { FeatureSnapshot } from '../types/snapshot';

/* building promt string */
export function buildSnapshotPrompt(data: FeatureSnapshot[]): string {
	return `
			You are a benchmark performance analyst evaluating benchmark metrics.

			The dataset contains aggregated latency statistics for three backend services
			(go, node, python) running on a free-tier environment.

			Each row represents one service with the following metrics:

			- p50_latency_s → median latency
			- p95_latency_s → tail latency under moderate load
			- p99_latency_s → extreme tail latency
			- tail_ratio_p95_p50 → latency spread indicator
			- tail_ratio_p99_p95 → extreme latency instability indicator
			- success_rate → fraction of successful requests

			Your task is to analyze service performance.

			Focus on:

			- p50 latency (baseline speed)
			- p95 latency (tail performance)
			- p99 latency (worst-case latency)
			- tail ratios (stability of latency distribution)
			- success rate

			Identify:

			1. Fastest service (lowest median latency)
			2. Most stable service (lowest tail latency ratios)
			3. Any anomalies or unusual behavior

			Return the analysis in the following structure:

			Performance Summary:
			...

			Stability Observations:
			...

			Potential Anomalies:
			...

			Important rules:

			- Base conclusions strictly on the provided data
			- Do not speculate about internal implementation details
			- Do not infer or estimate missing values.
			- Prefer quantitative observations over qualitative guesses
			- Use only the provided metrics.
			- Be precise and avoid mentioning internal IDs or row identifiers.
			- Keep the response concise and under 230 words.
			- Avoid repeating similar observations.

			Dataset:
			${JSON.stringify(data)}
			`;
}
