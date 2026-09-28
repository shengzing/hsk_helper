import { createApp } from "./app.js";
import { createAppDatabase } from "./db/connection.js";
import { fileURLToPath } from "node:url";

const port = Number(process.env.PORT ?? 3001);
const defaultDbPath = fileURLToPath(new URL("../../data/app.db", import.meta.url));
const dbPath = process.env.DB_PATH ?? defaultDbPath;

const db = createAppDatabase(dbPath);
const app = createApp(db);

app.listen(port, () => {
    console.log(`HSK Helper server is running at http://localhost:${port}`);
});

