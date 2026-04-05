export const fetchP2POrders = async (
  apiKey: string, 
  secretKey: string, 
  page: number = 1
): Promise<any> => {
  const res = await fetch("http://localhost:3001/api/p2p-orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      apiKey,
      secretKey,
      page
    })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({}));
    throw new Error(`Error en Proxy Binance: ${errData.error || res.statusText}`);
  }

  return await res.json();
};
