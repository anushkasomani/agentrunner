import express from "express";
const app = express();
app.use(express.json());

const NAME = process.env.VENDOR_NAME || "VendorSim";
const CAP = process.env.CAPABILITY || "swap.spl";
const PRICE = Number(process.env.PRICE_USD || "0.12");
const REL = Number(process.env.RELIABILITY || "0.90");

app.get("/price", (req, res) => {
  const qcap = String(req.query.capability || CAP);
  if (qcap !== CAP) return res.status(404).json({ error: "capability not supported" });
  res.set({ "X-402-Price": PRICE.toFixed(2), "X-402-Currency": "USDC", "X-402-Description": `${NAME} ${CAP}` });
  res.json({ vendor: NAME, capability: CAP, price_usd: PRICE, reliability: REL });
});

app.listen(7100, () => console.log(`${NAME} listening`));
