export interface FeatureSnapshot {
	service: string;
	p50_latency_s: number;
	p95_latency_s: number;
	p99_latency_s: number;
	tail_ratio_p95_p50: number;
	tail_ratio_p99_p95: number;
	success_rate: number;
	run_timestamp: string;
}

export interface AggregatedService {
	service: string;
	avg_p50_latency_s: number; /* speed */
	avg_p95_latency_s: number; /* risk in rare cases */
	avg_p99_latency_s: number; /* risk in extreme cases */
	avg_tail_ratio_p95_p50: number; /* stability */
	avg_tail_ratio_p99_p95: number; /* stability */
	avg_success_rate: number;
	min_p50_latency_s: number;
	max_p50_latency_s: number;
	stability_score: number; /* stability layer */
	range_p50_latency_s: number; /* risk layer */
	min_success_rate: number; /* risk layer */
	sample_size: number; /* context layer */
}

export type AnalysisInsert = {
	model: string;
	model_version: string;
	prompt_version: string;
	analysis: string;
	dataset: string;
	data_since: string;
};
