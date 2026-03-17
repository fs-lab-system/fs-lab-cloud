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
