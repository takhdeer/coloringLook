import express from "express";

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});