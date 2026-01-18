import express from "express";
import { pipeline } from "@xenova/transformers";
import { spawn } from "child_process";
import mongoose from "mongoose";
import dotenv from "dotenv";
import { Account, FridgeItem } from "./db.js";
import {
  GoogleGenAI,
  createUserContent,
  createPartFromUri,
} from "@google/genai";
import cors from "cors";
import fs from "fs";
import sharp from "sharp";
import path from "path";

const app = express();
const port = 3333;

dotenv.config();

const MAX_FRAMES = 10;

function enforceFrameLimit(folder) {
  const files = fs
    .readdirSync(folder)
    .map((name) => ({
      name,
      time: fs.statSync(path.join(folder, name)).mtimeMs,
    }))
    .sort((a, b) => a.time - b.time); // oldest → newest

  if (files.length > MAX_FRAMES) {
    const excess = files.length - MAX_FRAMES;
    const toDelete = files.slice(0, excess);

    for (const file of toDelete) {
      fs.unlinkSync(path.join(folder, file.name));
    }
  }
}

mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API });

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

app.get("/prompt", async (req, res) => {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: req.body.prompt,
  });

  res.send(response.text);
});

app.put("/fridge/:email", async (req, res) => {
  const response = await fetch("http://10.19.130.119/capture");
  const buffer = Buffer.from(await response.arrayBuffer());

  const email = req.params.email;

  const folder = path.join(process.cwd(), "frames");
  fs.mkdirSync(folder, { recursive: true });

  const timestamp = Date.now();

  const filename = `frame_${timestamp}.jpg`;
  const filepath = path.join(folder, filename);

  fs.writeFileSync(filepath, buffer);
  enforceFrameLimit(folder);

  const image = await ai.files.upload({
    file: filepath,
  });

  const aiResponse = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      createUserContent([
        "List all of the food items present in the image, seperated only with commas and no spaces",
        createPartFromUri(image.uri, image.mimeType),
      ]),
    ],
  });

  const items = aiResponse.candidates[0].content.parts[0].text.split(",");

  for (const name of items) {
    await FridgeItem.updateOne(
      { name, email },
      {
        $setOnInsert: { firstSeenAt: new Date(timestamp) },
        $set: { lastSeenAt: new Date(timestamp) },
      },
      { upsert: true },
    );
  }

  await FridgeItem.deleteMany({
    email,
    lastSeenAt: { $lt: new Date(timestamp) },
    name: { $nin: items },
  });

  return res.status(200).json({
    timestamp,
    items,
  });
});

app.get("/fridge/:email", async (req, res) => {
  const items = await FridgeItem.find({ email: req.params.email });
  res.json(items);
});

app.post("/user", async (req, res) => {
  try {
    console.log(req);
    const { firstName, lastName, dateOfBirth, email, password } =
      req.body || {};

    if (!firstName || !lastName || !dateOfBirth || !email || !password) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const account = new Account({
      firstName,
      lastName,
      dateOfBirth,
      email,
      password,
    });

    await account.save();

    res.status(201).json({ message: "Account created" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const account = await Account.findOne({ email });
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.status(200).json(account);
  } catch (err) {
    console.error("Error retrieving account:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/user/:email/dietaryRestrictions", async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const { dietaryRestrictions } = req.body || {};
    if (!dietaryRestrictions || !dietaryRestrictions.length) {
      return res.status(400).json({ error: "Missing dietary restrictions" });
    }

    const updated = await Account.findOneAndUpdate(
      { email },
      { "preferences.dietaryRestrictions": dietaryRestrictions },
      { new: true },
    );
    if (!updated) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error("Error updating dietary restrictions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/user/:email/dietaryRestrictions", async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const account = await Account.findOne({ email });
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.status(200).json(account.preferences.dietaryRestrictions);
  } catch (err) {
    console.error("Error retrieving dietary restrictions:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/user/:email/allergies", async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const { allergies } = req.body || {};
    if (!allergies || !allergies.length) {
      return res.status(400).json({ error: "Missing allergies" });
    }

    const updated = await Account.findOneAndUpdate(
      { email },
      { "preferences.allergies": allergies },
      { new: true },
    );
    if (!updated) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error("Error updating allergies:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/user/:email/allergies", async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const account = await Account.findOne({ email });
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.status(200).json(account.preferences.allergies);
  } catch (err) {
    console.error("Error retrieving allergies:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/user/:email/recipeInterests", async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const { recipeInterests } = req.body || {};
    if (!recipeInterests || !recipeInterests.length) {
      return res.status(400).json({ error: "Missing recipe interests" });
    }

    const updated = await Account.findOneAndUpdate(
      { email },
      { "preferences.recipeInterests": recipeInterests },
      { new: true },
    );
    if (!updated) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error("Error updating recipe interests:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.get("/user/:email/recipeInterests", async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const account = await Account.findOne({ email });
    if (!account) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.status(200).json(account.preferences.recipeInterests);
  } catch (err) {
    console.error("Error retrieving recipe interests:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.put("/user/:email/fridgeHousehold", async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const { fridgeCode, householdName } = req.body || {};
    if (!fridgeCode || !householdName) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const updated = await Account.findOneAndUpdate(
      { email },
      { fridgeCode: fridgeCode, householdName: householdName },
      { new: true },
    );
    if (!updated) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.status(200).json(updated);
  } catch (err) {
    console.error("Error updating recipe interests:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.delete("/user/:email", async (req, res) => {
  try {
    const { email } = req.params;
    if (!email) {
      return res.status(400).json({ error: "Missing email" });
    }

    const deleted = await Account.findOneAndDelete({ email });
    if (!deleted) {
      return res.status(404).json({ error: "Account not found" });
    }

    res.status(200).json(deleted);
  } catch (err) {
    console.error("Error deleting account:", err);
    res.status(500).json({ error: "Internal server error" });
  }
});

app.listen(port, () => {
  console.log(`Listening at http://localhost:${port}`);
});
