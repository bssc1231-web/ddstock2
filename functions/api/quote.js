export async function onRequest(context) {
  const url = new URL(context.request.url);
  const ticker = url.searchParams.get('ticker');
  const range = url.searchParams.get('range') || '3mo';
  const interval = url.searchParams.get('interval') || '1d';

  if (!ticker) {
    return new Response(JSON.stringify({ error: 'ticker required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
    });
  }

  const fetchHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120',
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Referer': 'https://finance.yahoo.com/',
  };

  // range → timestamp 변환 (캐싱 우회 + 정확한 기간)
  const now = Math.floor(Date.now() / 1000);
  const rangeMap = { '3mo': 90, '6mo': 180, '1y': 365, '2y': 730 };
  const days = rangeMap[range] || 90;
  const from = now - days * 86400;

  const endpoints = [
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&period1=${from}&period2=${now}&includePrePost=false`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&period1=${from}&period2=${now}&includePrePost=false`,
    `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&includePrePost=false`,
    `https://query2.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=${interval}&range=${range}&includePrePost=false`,
  ];

  for (const endpoint of endpoints) {
    try {
      const res = await fetch(endpoint, { headers: fetchHeaders });
      if (!res.ok) continue;
      const data = await res.json();
      const result = data?.chart?.result?.[0];
      if (!result) continue;
      const closes = result.indicators?.quote?.[0]?.close?.filter(v => v != null) || [];
      if (closes.length < 5) continue;
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'no-cache, no-store'
        }
      });
    } catch (e) { continue; }
  }

  return new Response(JSON.stringify({ error: '데이터 없음', range, interval }), {
    status: 500,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  });
}
