/**
 * Welcome to Cloudflare Workers! This is your first worker.
 *
 * - Run `npm run dev` in your terminal to start a development server
 * - Open a browser tab at http://localhost:8787/ to see your worker in action
 * - Run `npm run deploy` to publish your worker
 *
 * Bind resources to your worker in `wrangler.jsonc`. After adding bindings, a type definition for the
 * `Env` object can be regenerated with `npm run cf-typegen`.
 *
 * Learn more at https://developers.cloudflare.com/workers/
 */

/* Interfaces */
interface BenchmarkRun {
	service: string;
	endpoint: string;
	response_time_ms: number;
	status_code: number;
	region: string;
	created_at: string;
}

interface FeatureSnapshot {
	service: string;
	p50_latency_s: number;
	p95_latency_s: number;
	p99_latency_s: number;
	tail_ratio_p95_p50: number;
	tail_ratio_p99_p95: number;
	success_rate: number;
	run_timestamp: string;
}

/* ENTRY POINT OF WORKER */
export default {
	/* HTTP request handler, 
	request = HTTP request,
	env = Cloudflare binding (for example Storage),
	ctx = Execution Content (backgroundjobs)
	*/
	async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
		/* create the HTTP response */
		try {
			/* AI-WORKERS */
			const MODEL_LLAMA: any = '@cf/meta/llama-3.1-8b-instruct-fp8';
			const MODEL_MISTRAL: any = '@cf/mistral/mistral-7b-instruct-v0.1';
			const PROMPT_VERSION = 'v1';

			/* get current URL */
			const url = new URL(request.url);

			/* TESTING */
			if (url.pathname === '/kv-test') {
				const testData = {
					message: 'KV storage works',
					time: new Date().toISOString(),
				};

				await env.AI_ANALYSIS.put('kv_test', JSON.stringify(testData));

				const stored = await env.AI_ANALYSIS.get('kv_test');

				return Response.json({
					written: testData,
					readBack: stored ? JSON.parse(stored) : null,
				});

				/* PRODUCTIVE, NORMAL WORKER CODE */
			} else {
				/*get the last 3 days*/
				const since3Days: string = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();
				const since2Days: string = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString();

				/* base URL for query */
				const supabaseRestBase: string = `${env.SUPABASE_URL}/rest/v1/`;

				/* specific parameters for query */
				const runsQuery: string = `?created_at=gte.${since2Days}&order=created_at.desc`;
				const snapshotsQuery: string = `?run_timestamp=gte.${since3Days}&order=run_timestamp.desc`;

				/* benchmarks_runs once per hours for 3 services (3 rows per hour -> 24 rows per day). 
				For 3 days: 24 hours * 3 services * 3 days = 216 */
				const runsResponse = await fetch(supabaseRestBase + 'benchmark_runs' + runsQuery, {
					headers: {
						apikey: env.SUPABASE_PUBLISHABLE_KEY,
						Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
					},
				});

				/* snapshot_feature table runs once per day for 3 services of the entire day 
			(3 rows per day -> 1 row for each service). 
			For 3 days:  = 3 days * 3 services = 9 rows */
				const snapshotsResponse = await fetch(supabaseRestBase + 'service_feature_snapshots' + snapshotsQuery, {
					headers: {
						apikey: env.SUPABASE_PUBLISHABLE_KEY,
						Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
					},
				});

				/* more robust code, easier to debug */
				const runData = (await runsResponse.json()) as BenchmarkRun[];
				const snapshotData = (await snapshotsResponse.json()) as FeatureSnapshot[];

				/* reduce amount of input */
				const dataset = {
					benchmark_runs: runData.slice(0, 75),
					snapshots: snapshotData,
				};

				/* PROMPS FOR AI */
				const runsPrompt = `
					You are a benchmark performance analyst evaluating raw backend request metrics.

					The dataset contains individual benchmark request results (raw data) from three backend services
					(go, node, python).

					Each row represents a single request measurement with:

					- service → backend implementation
					- endpoint → API endpoint tested
					- response_time_ms → request latency in milliseconds
					- status_code → HTTP response status
					- region → region where the request originated
					- created_at → timestamp of the measurement

					Important:
					These are raw request measurements which may contain noise and outliers.
					Focus on overall patterns rather than individual extreme values.

					Your task is to analyze service performance based on these measurements.

					Focus on:

					- overall latency distribution
					- consistency of response times
					- presence of latency spikes
					- success vs failure rates
					- differences between services

					Identify:

					1. Fastest service (lowest typical latency)
					2. Most stable service (most consistent response times)
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
					- Ignore isolated outliers unless they appear repeatedly
					- Prefer quantitative observations over qualitative guesses
					- Be concise
					- Return a concise analysis.

					Dataset:
					${JSON.stringify(dataset.benchmark_runs.slice(0, 220))}
					`;

				const snapshotPrompt = `
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
					- Prefer quantitative observations over qualitative guesses
					- Be concise
					- Return a concise analysis.

					Dataset:
					${JSON.stringify(dataset.snapshots)}
					`;

				/* limit Token usage */
				const maxTokenSize: number = 400;

				/*limit creativity */
				const creativityTemperature: number = 0.2;

				/***/
				const llamaRuns = await env.AI.run(MODEL_LLAMA, {
					messages: [{ role: 'user', content: runsPrompt }],
					max_tokens: maxTokenSize,
					temperature: creativityTemperature,
				});

				const mistralRuns = await env.AI.run(MODEL_MISTRAL, {
					messages: [{ role: 'user', content: runsPrompt }],
					max_tokens: maxTokenSize,
					temperature: creativityTemperature,
				});

				const llamaSnapshots = await env.AI.run(MODEL_LLAMA, {
					messages: [{ role: 'user', content: snapshotPrompt }],
					max_tokens: maxTokenSize,
					temperature: creativityTemperature,
				});

				const mistralSnapshots = await env.AI.run(MODEL_MISTRAL, {
					messages: [{ role: 'user', content: snapshotPrompt }],
					max_tokens: maxTokenSize,
					temperature: creativityTemperature,
				});

				const noValidResponse: string = 'NO VALID ANALYSIS GENERATED!';
				/* responses */
				const llamaRunsAnalysis = llamaRuns.response?.trim() || noValidResponse;
				const mistralRunsAnalysis = mistralRuns.response?.trim() || noValidResponse;
				const llamaSnapshotsAnalysis = llamaSnapshots.response?.trim() || noValidResponse;
				const mistralSnapshotsAnalysis = mistralSnapshots.response?.trim() || noValidResponse;

				/* return JOSN response of both requests */
				return Response.json({
					llamaRunsAnalysis: llamaRunsAnalysis,
					mistralRunsAnalysis: mistralRunsAnalysis,
					llamaSnapshotsAnalysis: llamaSnapshotsAnalysis,
					mistralSnapshotsAnalysis: mistralSnapshotsAnalysis,
				});
			}
		} catch (err) {
			/* DEBUGGING INFO */
			return new Response(
				JSON.stringify({
					error: String(err),
					url: env.SUPABASE_URL,
					key: env.SUPABASE_PUBLISHABLE_KEY ? 'exists' : 'missing',
				}),
				{ status: 500 },
			);
		}
	},
} satisfies ExportedHandler<Env>;
