export function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };
}

export function jsonResponse(data, status) {
  return new Response(JSON.stringify(data), { status: status || 200, headers: corsHeaders() });
}
