import express from "express";
import { pipeline } from "@xenova/transformers";
import { spawn } from "child_process";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Account } from "./db.js";
import fs from "fs";
import path from "path";

const app = express();
const port = 3333;

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

let classifier;
async () => {
  classifier = await pipeline(
    "image-classification",
    "BinhQuocNguyen/food-recognition-model",
  );
};

app.get("/", (req, res) => {
  res.status(200).send("Hello!!!!!");
});

app.get("/frame", async (req, res) => {
  const response = await fetch("http://172.20.10.2/capture");
  const buffer = Buffer.from(await response.arrayBuffer());

  const folder = path.join(process.cwd(), "frames");
  fs.mkdirSync(folder, { recursive: true });

  const filename = `frame_${Date.now()}.jpg`;
  const filepath = path.join(folder, filename);

  fs.writeFileSync(filepath, buffer);

  res.json({ file: filename });
});

app.get("/predict", async (req, res) => {
  const response = await fetch("http://172.20.10.2/capture");
  const buffer = Buffer.from(await response.arrayBuffer());

  const py = spawn("python3", ["predict.py"]);
  py.stdout.on("data", (d) => (output += d.toString()));

  py.on("close", () => res.json(JSON.parse(output)));

  py.stdin.write(buffer);
  py.stdin.end();
});

app.post("/write", (req, res) => {
  console.log(req.body);
  const { firstName, lastName, dateOfBirth, email, password } = req.body;
  const account = new Account({
    firstName,
    lastName,
    dateOfBirth,
    email,
    password,
  });

  account.save();

  res.status(200).send("Login received");
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
