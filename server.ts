import express from "express";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";

dotenv.config();

async function startServer() {
  const app = express();
  const PORT = 3000;
  app.use(express.json());

  // API Route to proxy Google Sheets (과제리뷰 조회)
  app.get("/api/tasks", async (req, res) => {
    const SHEET_API_URL = process.env.VITE_SHEET_API_URL || "https://script.google.com/macros/s/AKfycbx4Pl0kK7kYFO7RJv4o2KC980r7tJnaItBIXIG9tARMLow7ocHHGlYLNt8bB4ZpsQD0/exec";
    
    try {
      console.log("Server proxying request to Google Sheets...");
      // @ts-ignore - Node 18+ has global fetch
      const response = await fetch(SHEET_API_URL);
      
      if (!response.ok) {
        return res.status(response.status).json({ error: `Google API returned ${response.status}` });
      }
      
      const data = await response.json();
      res.json(data);
    } catch (error: any) {
      console.error("Server-side fetch error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // POST: 작성 내용을 구글 시트 "작성내용" 시트에 저장
  app.post("/api/save", async (req, res) => {
    const SHEET_API_URL = process.env.VITE_SHEET_API_URL || "https://script.google.com/macros/s/AKfycbx4Pl0kK7kYFO7RJv4o2KC980r7tJnaItBIXIG9tARMLow7ocHHGlYLNt8bB4ZpsQD0/exec";
    try {
      const response = await fetch(SHEET_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(req.body),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status).json(data || { error: "Sheet API error" });
      }
      res.json(data);
    } catch (error: any) {
      console.error("Save to sheet error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // GET: 작성내용 조회 (type=written)
  app.get("/api/written", async (req, res) => {
    const SHEET_API_URL =
      process.env.VITE_SHEET_API_URL ||
      "https://script.google.com/macros/s/AKfycbx4Pl0kK7kYFO7RJv4o2KC980r7tJnaItBIXIG9tARMLow7ocHHGlYLNt8bB4ZpsQD0/exec";
    try {
      const url = new URL(SHEET_API_URL);
      url.searchParams.set("type", "written");
      if (typeof req.query.userKey === "string") url.searchParams.set("userKey", req.query.userKey);
      if (typeof req.query.taskId === "string") url.searchParams.set("taskId", req.query.taskId);

      // @ts-ignore - Node 18+ has global fetch
      const response = await fetch(url.toString(), { cache: "no-store" });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        return res.status(response.status).json(data || { error: `Google API returned ${response.status}` });
      }
      res.json(data);
    } catch (error: any) {
      console.error("Written fetch error:", error);
      res.status(500).json({ error: error.message || "Internal Server Error" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
