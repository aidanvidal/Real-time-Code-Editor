const http = require("http");
const express = require("express");
const ShareDB = require("sharedb");
const WebSocket = require("ws");
const WebSocketJSONStream = require("@teamwork/websocket-json-stream");
const path = require("path");
const cors = require("cors");
const { VM } = require('vm2');
const mongodb = require('mongodb');
const ShareDBMongo = require('sharedb-mongo');

// Connect to MongoDB
const mongoUrl = 'mongodb://localhost:27017/sharedb';
const db = ShareDBMongo(mongoUrl);

// Create a ShareDB backend using the MongoDB adapter
const backend = new ShareDB({ db, presence: true });

createDoc(startServer);

function createDoc(callback) {
  const connection = backend.connect();
  const doc = connection.get("examples", "textarea");
  doc.fetch(function (err) {
    if (err) throw err;
    if (doc.type === null) {
      doc.create({ content: "" }, callback);
      return;
    }
    callback();
  });
}

function startServer() {
  const app = express();

  app.use(cors({ origin: "http://localhost:3000" }));
  app.use(express.static(path.join(__dirname, "client/build")));
  app.use(express.json());

  app.post("/execute", express.json(), (req, res) => {
    const { code } = req.body;
    const vm = new VM({
      timeout: 1000,
      sandbox: {},
    });

    try {
      const result = vm.run(code);
      res.json({ result: result });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.get("*", (req, res) => {
    res.sendFile(path.join(__dirname, "client/build", "index.html"));
  });

  const server = http.createServer(app);

  const wss = new WebSocket.Server({ server: server });
  wss.on("connection", function (ws) {
    const stream = new WebSocketJSONStream(ws);
    backend.listen(stream);
  });

  const port = 3001;
  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}`);
  });
}