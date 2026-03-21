import { FeatureSnapshot } from '../types/snapshot';

/* fetch function */
export async function fetchSnapshots(env: Env, days: number): Promise<FeatureSnapshot[]> {
	/*get the last 3 days*/
	const since: string = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString();

	/* base URL for query */
	const supabaseRestBase: string = `${env.SUPABASE_URL}/rest/v1/`;
	const databaseTable: string = `/service_feature_snapshots`;
	const timeStampBase: string = `?run_timestamp=gte.${since}&order=run_timestamp.desc`;

	/* specific parameters for query */
	const url = supabaseRestBase + databaseTable + timeStampBase;

	const res = await fetch(url, {
		headers: {
			apikey: env.SUPABASE_PUBLISHABLE_KEY,
			Authorization: `Bearer ${env.SUPABASE_PUBLISHABLE_KEY}`,
		},
	});

	/* if error, return */
	if (!res.ok) {
		const text = await res.text();
		throw new Error(`Supabase error: ${res.status} - ${text}`);
	}

	return (await res.json()) as FeatureSnapshot[];
}
