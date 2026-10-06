const express = require("express");
const app = express();
const PORT = process.env.PORT || 4000;
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");
const { getWord } = require("./api.js");
const { info } = require("console");
const rooms = {}
const customInfoList = {};
const active = {
    currentScore: ["pending", "pending"]
};

// Create an HTTP server using Express
const server = http.createServer(app);

// Attach Socket.IO to the HTTP server
const io = new Server(server);

// Listen for new connectionsS
io.on("connection", (socket) => {
    //console.log("A player connected:", socket.id);
    
    socket.on("requesting-word", (ID) => {
        sendWord(ID);
    })

    socket.on("create-room", mode => {
        const roomCode = generateCode();
        socket.join(roomCode);
        rooms[roomCode] = {
            players: [socket.id],
            scores: [0, 0],
            mode,
            info: {}
        }
        socket.emit("room-created", roomCode);
    })

    socket.on("join-room", async (attemptedRoomCode, mode) => {
        if (!rooms[attemptedRoomCode]) {
            io.to(socket.id).emit("error", `room with code: ${attemptedRoomCode} doesn't exist`)
            return;
        }
        
        if (rooms[attemptedRoomCode].mode !== mode) {
            io.to(socket.id).emit("error", `No ${mode} with code: ${attemptedRoomCode}`)
            return;
        }
        
        if (rooms[attemptedRoomCode].players.length === 2) {
            io.to(socket.id).emit("error", `Room with code: ${attemptedRoomCode} is full`)
            return;
        }
        
        
        if (mode === "duo-same") {
            const data = await getWord();
            rooms[attemptedRoomCode].info = data;
            rooms[attemptedRoomCode].players.push(socket.id);
            socket.join(attemptedRoomCode);
            socket.to(attemptedRoomCode).emit("match-ready", {type: "info", message: "players connected", code: attemptedRoomCode, mode});
        } else if (mode === "duo-exchange") {
            swapNStore(attemptedRoomCode, mode);
        }

        const ID1 = rooms[attemptedRoomCode].players[0];
        const ID2 = rooms[attemptedRoomCode].players[1];
        
        const results = {
            [ID1]: rooms[attemptedRoomCode].scores[0],
            [ID2]: rooms[attemptedRoomCode].scores[1]
        }
        io.to(attemptedRoomCode).emit("send-results", results);
    })

    function swapNStore(attemptedRoomCode, mode) {
        rooms[attemptedRoomCode].info[rooms[attemptedRoomCode].players[0]] = customInfoList[socket.id];
        rooms[attemptedRoomCode].info[socket.id] = customInfoList[rooms[attemptedRoomCode].players[0]];
        rooms[attemptedRoomCode].players.push(socket.id);
        socket.join(attemptedRoomCode);
        active.players = [rooms[attemptedRoomCode].players[0], socket.id];
        active.roomCode = attemptedRoomCode;
        active.arePlayersReady = [true, true];
        socket.to(attemptedRoomCode).emit("match-ready", {type: "info", message: "players connected", code: attemptedRoomCode, mode});
    }

    socket.on("get-info", async (attemptedRoomCode, mode) => {
        const allRooms = socket.rooms;
        if (mode === "duo-same") {
            if (rooms[attemptedRoomCode].info.word) {
                const data = await getWord();
                rooms[attemptedRoomCode].info = data
            }
            const data = rooms[attemptedRoomCode].info;
            io.to(attemptedRoomCode).emit("get-data", data, attemptedRoomCode, allRooms);
        } else if (mode === "duo-exchange") {
            //-----------------need to work on this
            io.to(rooms[attemptedRoomCode].players[0]).emit("get-data", rooms[attemptedRoomCode].info[rooms[attemptedRoomCode].players[0]], attemptedRoomCode, allRooms);
            io.to(rooms[attemptedRoomCode].players[1]).emit("get-data", rooms[attemptedRoomCode].info[rooms[attemptedRoomCode].players[1]], attemptedRoomCode, allRooms);
        }
    })

    socket.on("cancel-room", roomCode => {
        delete rooms[roomCode];
    })

    socket.on("won", (roomCode, id, mode, points) => {
        const code = rooms[roomCode].players[0] === id? rooms[roomCode].players[1]: rooms[roomCode].players[0];
        if (mode === "duo-exchange") {
            if (rooms[roomCode].players[0] === id) {
                active.currentScore[0] = "won";
                rooms[roomCode].scores[0] += points;
            } else {
                active.currentScore[1] = "won";
                rooms[roomCode].scores[1] += points;
            }

            if (active.currentScore[0] === "pending" || active.currentScore[1] === "pending") {
                socket.to(code).emit("start-timer");
            } else {
                const ID1 = rooms[roomCode].players[0];
                const ID2 = rooms[roomCode].players[1];
                const results = {
                    [ID1]: rooms[roomCode].scores[0],
                    [ID2]: rooms[roomCode].scores[1]
                }
                io.to(roomCode).emit("send-results", results);
            }
        } else if (mode === "duo-same") {
            let loser
            if (rooms[roomCode].players[0] === id) {
                active.currentScore[0] = "won";
                rooms[roomCode].scores[0] += points;
                loser = 1;
            } else {
                active.currentScore[1] = "won";
                rooms[roomCode].scores[1] += points;
                loser = 0;
            }

            if (active.currentScore[0] === "pending" || active.currentScore[1] === "pending") {
                active.currentScore[loser] = "lost";
                socket.to(code).emit("you-lose", `Game over player A wins, you lose!`);
            }

            console.log(`sending winning results`);
                
            const ID1 = rooms[roomCode].players[0];
            const ID2 = rooms[roomCode].players[1];
            const results = {
                [ID1]: rooms[roomCode].scores[0],
                [ID2]: rooms[roomCode].scores[1]
            }
            io.to(roomCode).emit("send-results", results);
        }
    })

    socket.on("clean", (roomCode, id, cleanType) => {
        const code = rooms[roomCode].players[0] === id? rooms[roomCode].players[1]: rooms[roomCode].players[0];
        if (cleanType === "duo-same-play-again") {
            active.currentScore[0] = active.currentScore[1] = "pending";
            socket.to(code).emit("clean-up");
        } else if (cleanType === "duo-exchange-play-again") {
            socket.to(code).emit("clean-up");
            socket.to(code).emit("displayCustomWordCont", cleanType);
        }
    })

    socket.on("send-custom-info", (info, id, RoomCode, playAgainExchange, mode) => {
        if (!playAgainExchange) {
            customInfoList[id] = info;
        } else {

            customInfoList[id] = info;
            if (rooms[RoomCode].players[0] === id) {
                active.currentScore[0] = "pending";
            } else {
                active.currentScore[1] = "pending";
            }

            if (active.currentScore[0] !== "pending" || active.currentScore[1] !== "pending") {
                io.to(id).emit("waiting");
            } else {
                rooms[RoomCode].info[rooms[RoomCode].players[0]] = customInfoList[rooms[RoomCode].players[1]];
                rooms[RoomCode].info[rooms[RoomCode].players[1]] = customInfoList[rooms[RoomCode].players[0]];
                socket.to(RoomCode).emit("match-ready", {type: "info", message: "players connected", code: RoomCode, mode});
            }
        }
    })

    socket.on("you-lost", (id, roomCode, mode) => { 
        const code = rooms[roomCode].players[0] === id? rooms[roomCode].players[1]: rooms[roomCode].players[0];

        if (rooms[roomCode].players[0] === id) {
            active.currentScore[0] = "lost";
        } else {
            active.currentScore[1] = "lost";
        }
        
        if (active.currentScore[0] === "pending" || active.currentScore[1] === "pending") {
            socket.to(code).emit("start-timer");
        } else {
            const ID1 = rooms[roomCode].players[0];
            const ID2 = rooms[roomCode].players[1];
            const results = {
                [ID1]: rooms[roomCode].scores[0],
                [ID2]: rooms[roomCode].scores[1]
            }
            io.to(roomCode).emit("send-results", results);
        }
    })

    socket.on("trigger-loss", (roomCode, id, massage) => {
        io.to(id).emit("you-lose", massage);
    })

    socket.on("check-room", (id, RoomCode) => {
        deleteRoom(id, RoomCode);
    })

    function deleteRoom(id, RoomCode) {
        if (rooms[RoomCode].players.length === 2) {
            const code = rooms[RoomCode].players[0] === id? rooms[RoomCode].players[1]: rooms[RoomCode].players[0];
            socket.to(code).emit("disconnect-room");
            socket.leave(RoomCode);
            delete rooms[code];
        } else {
            socket.leave(RoomCode);
            delete rooms[RoomCode];
        }
    }

    socket.on("leave-room", RoomCode => {
            socket.leave(RoomCode);
    })

    socket.on("disconnect", () => {
        //console.log("A player disconnected: ", socket.id);
        const keys = Object.keys(rooms);

        if (!rooms[keys[0]]) return;
        if (rooms[keys[0]].players.length === 0) return;
        else if (rooms[keys[0]].players.length === 1) {
            if (!rooms[keys[0]].players.includes(socket.id)) return;
            socket.leave(RoomCode);
            delete rooms[code];
        } else {
            if (!rooms[keys[0]].players.includes(socket.id)) return;
            deleteRoom(socket.id, keys[0]);
        }
    });
});

app.use(express.static(path.join(__dirname, "..", "client", "static")));

async function sendWord(id) {
    try {
        const data = await getWord();
        io.to(id).emit("get-data", data);
    } catch (err) {
        console.error("Could not get word:", err.message);

        io.to(id).emit("word-error", {
            message: "Unable to load a word right now. Please try again."
        });
        io.to(id).emit("error", "Unable to load a word right now. Please try again.");
    }
}

function generateCode() {
    const letters = "abcdecghijklmnopqrstuvwxyz";
    const num1 = Math.floor(Math.random() * 10);
    const num2 = Math.floor(Math.random() * 10);
    let letter1 = letters.charAt(Math.floor(Math.random() * 26));
    let letter2 = letters.charAt(Math.floor(Math.random() * 26));
    Math.floor(Math.random() * 10) + 1 > 5? letter2 = letter2.toUpperCase(): letter1 = letter1.toUpperCase();
    return `${letter1}${num1}${letter2}${num2}`;
}

app.get("/", (req, res) => {
    res.sendFile(path.join(__dirname, "..", "client", "duelix.html"));
})

server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on port ${PORT}`);
});
