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
			// get the last 3 days
			const since = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString();

			/* benchmarks_runs once per hours for 3 services (3 rows per hour -> 24 rows per day). 
			For 3 days: 24 hours * 3 services * 3 days = 216 */
			const runsResponse = await fetch(`${env.SUPABASE_URL}/rest/v1/benchmark_runs?created_at=gte.${since}&order=created_at.desc`, {
				headers: {
					apikey: env.SUPABASE_PUBLISHABLE_KEY,
					Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
				},
			});

			/* snapshot_feature table runs once per day for 3 services of the entire day 
			(3 rows per day -> 1 row for each service). 
			For 3 days:  = 3 days * 3 services = 9 rows */
			const snapshotsResponse = await fetch(
				`${env.SUPABASE_URL}/rest/v1/service_feature_snapshots?run_timestamp=gte.${since}&order=run_timestamp.desc`,
				{
					headers: {
						apikey: env.SUPABASE_PUBLISHABLE_KEY,
						Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
					},
				},
			);

			/*saving time by parrallel requests */
			const [runData, snapshotData] = await Promise.all([runsResponse.json(), snapshotsResponse.json()]);

			/* return JOSN response of both requests */
			return Response.json({
				runs: runData,
				snapshots: snapshotData,
			});
		} catch (err) {
			/* DEBUGGING */
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
