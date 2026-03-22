import { AggregatedService } from '../types/snapshot';

export function buildSnapshotPrompt(data: AggregatedService[]): string {
	return `
		You are a backend performance analyst evaluating aggregated service metrics.

		The dataset contains aggregated summaries across multiple days for three 
		backend services: go, node, python.

		Each row represents ONE service and already includes aggregated metrics.

		---

		Available metrics per service:

		- avg_p50_latency_s → baseline speed (lower is better)
		- avg_p95_latency_s → moderate tail latency
		- avg_p99_latency_s → extreme tail latency

		- avg_tail_ratio_p95_p50 → latency spread under load
		- avg_tail_ratio_p99_p95 → extreme latency instability

		- stability_score → combined instability indicator (lower is better)

		- range_p50_latency_s → difference between min and max latency (volatility indicator)
		- min_p50_latency_s / max_p50_latency_s → latency bounds

		- avg_success_rate → average reliability
		- min_success_rate → worst-case reliability (critical signal)

		- sample_size → number of observations used

		---

		Analysis objectives:

		1. Identify the fastest service (ONLY based on avg_p50_latency_s)
		2. Identify the most stable service (ONLY based on stability_score)
		3. Identify risk factors using:
			- range_p50_latency_s (volatility)
			- min_success_rate (worst-case reliability)

		---

		Decision rules (STRICT):

		- Speed MUST be determined ONLY by avg_p50_latency_s
		- Stability MUST be determined ONLY by stability_score
		- A service with low min_success_rate MUST be considered unreliable, even if fast
		- High range_p50_latency_s indicates instability and must be mentioned
		- Prefer overall trends, not extremes
		- If services are close in performance, explicitly say so
		- If metrics conflict (e.g. fast but unstable), clearly describe the trade-off

		---

		Output rules (STRICT):

		- DO NOT mention IDs, timestamps, or individual events
		- DO NOT list raw values repeatedly
		- DO NOT repeat the same observation across sections
		- Each bullet must provide new information
		- Maximum 4 bullet points per section
		- Keep response under 180 words
		- Be precise and analytical

		---

		Return output in EXACT format:

		Performance Summary:
		- ...

		Stability Observations:
		- ...

		Risk & Reliability:
		- ...

		---

		Dataset:
		${JSON.stringify(data)}
		`;
}
