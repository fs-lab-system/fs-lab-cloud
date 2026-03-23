import { AggregatedService, FeatureSnapshot } from '../types/snapshot';

/* round to 2 digits after decimal */
function round(value: number, decimals = 2): number {
	return Number(value.toFixed(decimals));
}

export function aggregateSnapshots(data: FeatureSnapshot[]): AggregatedService[] {
	/* if map is empty at this point, exit */
	if (data.length === 0) return [];

	/* save data in map */
	const map: Record<string, AggregatedService> = {};

	for (const row of data) {
		/* if service dosen´t  exist, create it */
		if (!map[row.service]) {
			/* TRANFORMATION : group by service */
			map[row.service] = {
				service: row.service,
				avg_p50_latency_s: 0,
				avg_p95_latency_s: 0,
				avg_p99_latency_s: 0,
				avg_tail_ratio_p95_p50: 0,
				avg_tail_ratio_p99_p95: 0,
				avg_success_rate: 0,
				min_p50_latency_s: Infinity,
				max_p50_latency_s: -Infinity,
				stability_score: 0,
				range_p50_latency_s: 0,
				min_success_rate: 1,
				sample_size: 0,
			};
		}

		/* get one service to assign values */
		const currentService: AggregatedService = map[row.service];

		/* adding numbers to SUMS */
		currentService.avg_p50_latency_s += row.p50_latency_s;
		currentService.avg_p95_latency_s += row.p95_latency_s;
		currentService.avg_p99_latency_s += row.p99_latency_s;
		currentService.avg_tail_ratio_p95_p50 += row.tail_ratio_p95_p50;
		currentService.avg_tail_ratio_p99_p95 += row.tail_ratio_p99_p95;
		currentService.avg_success_rate += row.success_rate;

		/* MIN/MAX latency for reference -> FEATURE */
		currentService.min_p50_latency_s = round(Math.min(currentService.min_p50_latency_s, row.p50_latency_s));
		currentService.max_p50_latency_s = round(Math.max(currentService.max_p50_latency_s, row.p50_latency_s));

		/* track worst-case success rate -> FEATURE */
		currentService.min_success_rate = Math.min(currentService.min_success_rate, row.success_rate);

		/* count the amount of data points */
		currentService.sample_size++;
	}

	for (const currentService of Object.values(map)) {
		/* sums / count = average, classic AGGREGATION */
		currentService.avg_p50_latency_s = round(currentService.avg_p50_latency_s / currentService.sample_size);
		currentService.avg_p95_latency_s = round(currentService.avg_p95_latency_s / currentService.sample_size);
		currentService.avg_p99_latency_s = round(currentService.avg_p99_latency_s / currentService.sample_size);

		currentService.avg_tail_ratio_p95_p50 = round(currentService.avg_tail_ratio_p95_p50 / currentService.sample_size);
		currentService.avg_tail_ratio_p99_p95 = round(currentService.avg_tail_ratio_p99_p95 / currentService.sample_size);

		/* 3 digits for more precision */
		currentService.avg_success_rate = round(currentService.avg_success_rate / currentService.sample_size, 3);

		/* the smaller the stability score,
       the more stable it gets -> FEATURE */
		currentService.stability_score = round(currentService.avg_tail_ratio_p95_p50 + currentService.avg_tail_ratio_p99_p95);

		/* range between min and max p50 latency */
		currentService.range_p50_latency_s = round(currentService.max_p50_latency_s - currentService.min_p50_latency_s);
	}

	return Object.values(map);
}
