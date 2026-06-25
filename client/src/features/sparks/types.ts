// Child's spark summary. Will be served by GET /sparks/me once the calculator
// (SUM of amount * settings.value, plus global rank) is built on the server.
export interface SparksSummary {
  sparks: number;
  rank: number;
  total: number;
}
