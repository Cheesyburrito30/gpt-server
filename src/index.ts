import cors from 'cors';
import { config } from 'dotenv';
import express from 'express';
import sqlite3 from 'sqlite3';

import { chatRoutes } from './chat';
import { presetRoutes } from './presets';

config();

const app = express();
const port = process.env.PORT || 3001;

app.use(express.json());
app.use(cors());

const db = new sqlite3.Database("./src/presets.db", (err) => {
  if (err) {
    console.error(err.message);
  }
  console.log("Connected to the SQLite database.");
});

chatRoutes(app, db);
presetRoutes(app, db);

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});

// Close the database connection when the server is terminated
process.on("SIGINT", () => {
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log("SQLite database connection closed.");
  });
  process.exit(0);
});
