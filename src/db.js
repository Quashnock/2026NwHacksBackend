import mongoose from "mongoose";
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
