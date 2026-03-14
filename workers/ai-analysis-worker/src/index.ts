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

/* ENTRY POINT OF WORKER */
export default {
	/* HTTP request handler, 
	request = HTTP request,
	env = Cloudflare binding (for example Storage),
	ctx = Execution Content (backgroundjobs)
	*/
	async fetch(request: Request, env: Env): Promise<Response> {
		/* create the HTTP response */
		try {
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
				const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

				/* base URL for query */
				const supabaseRestBase = `${env.SUPABASE_URL}/rest/v1/`;

				/* specific parameters for query */
				const runsQuery = `?created_at=gte.${since}&order=created_at.desc`;
				const snapshotsQuery = `?run_timestamp=gte.${since}&order=run_timestamp.desc`;

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

				/*saving time by parrallel requests */
				//const [runData, snapshotData] = await Promise.all([runsResponse.json(), snapshotsResponse.json()]);

				/* more robust code, easier to debug */
				const runData = await runsResponse.json();
				const snapshotData = await snapshotsResponse.json();

				/* return JOSN response of both requests */
				return Response.json({
					runs: runData,
					snapshots: snapshotData,
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
