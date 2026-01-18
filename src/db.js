import mongoose, { mongo } from "mongoose";
import dotenv from "dotenv";

dotenv.config();

mongoose.connect(process.env.MONGODB_URI);

export const Account = mongoose.model(
  "Account",
  new mongoose.Schema({
    firstName: {
      type: String,
      required: true,
      trim: true,
    },

    lastName: {
      type: String,
      required: true,
    },

    dateOfBirth: {
      type: String,
      required: true,
    },

    email: {
      type: String,
      required: true,
    },

    password: {
      type: String,
      required: true,
    },

    fridgeCode: {
      type: String,
    },

    householdName: {
      type: String,
    },

    preferences: {
      dietaryRestrictions: {
        type: [String],
        default: [],
      },
      allergies: {
        type: [String],
        default: [],
      },
      recipeInterests: {
        type: [String],
        default: [],
      },
    },
  }),
);

export const FridgeItem = mongoose.model(
  "FridgeItem",
  new mongoose.Schema({
    email: {
      type: String,
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
    },
    estimatedShelfLifeDays: {
      type: String,
      required: true,
    },
    firstSeenAt: {
      type: Date,
      required: true,
    },
    lastSeenAt: {
      type: Date,
      required: true,
    },
  }),
);
