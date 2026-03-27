/*  CORS HELPER */
export function withCORS(response: Response): Response {
	return new Response(response.body, {
		status: response.status,
		headers: {
			...Object.fromEntries(response.headers),
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'GET, OPTIONS',
			'Access-Control-Allow-Headers': '*',
		},
	});
}
