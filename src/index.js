import express from "express";

const app = express();
const port = 3333;

app.get("/", (req, res) => {
  res.status(200).send("Hello!!!!!");
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
