type AnalysisCache = {
	analyses: {
		llama?: string;
		mistral?: string;
		[key: string]: string | undefined;
	};
	aggregatedSnapshots: unknown;
	timestamp: string;
};
