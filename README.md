# Real Time Code Editor
A real time code editor for Javascript made using React, Node.js, and some JS libraries.
This project consists of two parts:
- Server: Built using Express, ShareDB, MongoDB, and WebSocket for real-time communication.
- Client: A React-based UI with AceEditor and WebSocket integration.
# Technologies Used
- React was used for the Frontend
- Node.js was used for the Backend
- Used ShareDB for the OT (Operational Transformation) to maintain consistency in the collaboritive editing.
- MongoDB is used to store the document history.
- AceEditor is used as the main coding editor.
- Websockets used to communicate the data to the server along with some HTTP
---
# Prerequisites
- Node.js (v14 or higher)
- MongoDB (for real-time collaboration backend)
- SQLite (if used for local database storage in the server)

# Server Setup
- Navigate to Server directory
- Install Dependencies
```terminal
$ npm install
```
- Start the MongoDB
```terminal
$ mongod
```
- Run the Server
```terminal
$ node server.js
```

# Client Setup
- Navigate to Client directory
- Install Dependencies
```terminal
$ npm install
```
- Start the Client
```terminal
$ npm start
```
---

# Where to find more
- Here is a [link](https://aidanvidal.github.io/) to my blog post about the creation process of this project.

---

Have a good day! 😄
