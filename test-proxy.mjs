async function test() {
  try {
    const res = await fetch("https://abitraje-report.vercel.app/api/binance", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ apiKey: "test", secretKey: "test", page: 1 })
    });
    const text = await res.text();
    console.log("Status:", res.status);
    console.log("Body:", text);
  } catch (e) {
    console.log("Error:", e);
  }
}
test();
