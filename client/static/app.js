"use strict";
let data;
const wordCont = document.getElementById("word-cont");
let innerLoader;
import { showToast } from "./toast.js";

let numOfCorrectLetters = 0;
let word;
let hint;
let twoWords = false;
let firstWord;
let secondWord;
let firstWordLetters = new Array();
let secondWordLetters = new Array();
let subLetters = firstWordLetters;
let mode = "singlePlayer";
const socket = io("http://localhost:4000");
let id;
let isDataReceived = false;
let time = 20;
let startTime;
let isTimerActive = false;
let attempedRoomCode;
let RoomCode;
let canRequestWord = true;
let playAgainExchange = false;
let isGameRunning = false;
let cleanCont = true;

socket.on("connect", () => {
  //console.log(`connected with id ${socket.id}`);
  id = socket.id;
  requestWord(id);
});

socket.on("get-data", (info, code, allRooms) => {
  RoomCode = code;
  finishLoading();
  data = info;
  word = data.word;
  hint = data.hint;
  showToast("game on");
  startGame();
});

socket.on("error", (message) => {
  showToast(message, "error");
});

socket.on("you-lose", (message) => {
  showToast(message, "info");
  submitBtn.removeEventListener("click", submitLetter);
  document.getElementById("message").textContent = message;
  messageCont.classList.toggle("show-result");
  playAgainBtn.focus();
});

socket.on("clean-up", () => {
  canRequestWord = false;
  playAgainBtn.click();
});

socket.on("displayCustomWordCont", (cleanType) => {
  playAgainExchange = true;
  cont.style.display = "none";
  customWordCardCont.style.display = "inline-block";
});

socket.on("disconnect-room", () => {
  socket.emit("leave-room", attempedRoomCode);
  attempedRoomCode = null;
  showToast("your opponent left", "info");
  cleanGameCont();
  requestWord(id);
  modeButtons[0].click();
});

socket.on("waiting", () => {
  customWordCardCont.style.display = "none";
  waitPopup.classList.toggle("hidden"); // remove "hidden" -> show
});

const scoreCard = document.getElementById("score-card");
const yourScore = document.getElementById("your-score");
const opponentScore = document.getElementById("opponent-score");
const scoreTitle = document.querySelector(".score-title");

socket.on("send-results", (results) => {
  const keys = Object.keys(results);
  const opponentId = keys[0] === id ? keys[1] : keys[0];
  yourScore.innerHTML = `${results[id]} <small>points</small>`;
  opponentScore.innerHTML = `${results[opponentId]} <small>points</small>`;

  isGameRunning = false;
  modeButtons.forEach((btn) => {
    btn.disabled = false;
  });
  scoreTitle.textContent = mode;
  scoreCard.style.display = "inline-block";
});

const TimeCont = document.getElementById("timerCont");
const timerCont = document.getElementById("timer");

socket.on("start-timer", () => {
  TimeCont.style.display = "flex";
  isTimerActive = true;

  startTime = setInterval(() => {
    time--;
    timerCont.textContent = time;

    if (time <= 0) {
      clearInterval(startTime);
      socket.emit("you-lost", id, attempedRoomCode, mode);
      socket.emit("trigger-loss", attempedRoomCode, id, "time's up, you lose");
      time = 20;
      TimeCont.style.display = "none";
      timerCont.textContent = time;
      isTimerActive = false;
    }
  }, 1000);
});

function requestWord(id) {
  if (innerLoader) {
    wordCont.innerHTML = "";
    innerLoader.style.display = "flex";
  }
  socket.emit("requesting-word", id);
}
/*  */

const modeButtons = document.querySelectorAll(".mode-btn");
const duoChoiceCont = document.getElementById("duo-choice-cont");
const joinCodeCont = document.getElementById("join-code-cont");
const duoLabel = document.getElementById("duo-label");
const createRoomBtn = document.getElementById("create-room-btn");
const joinRoomBtn = document.getElementById("join-room-btn");
const customWordCardCont = document.getElementById("custom-word-card");
const backToModesBtn = document.getElementById("back-to-modes-btn");
const backToChoiceBtn = document.getElementById("back-to-choice-btn");
const roomCodeInput = document.getElementById("room-code-input");
const submitCodeBtn = document.getElementById("submit-code-btn");

modeButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    modeButtons.forEach((b) => b.classList.remove("active-mode-btn"));
    btn.classList.add("active-mode-btn");

    mode = btn.dataset.mode;

    if (messageCont.classList.contains("show-result")) {
      messageCont.classList.toggle("show-result");
    }

    if (attempedRoomCode) {
      socket.emit("check-room", id, attempedRoomCode);
      cleanGameCont();
      submitBtn.removeEventListener("click", submitLetter);
      isGameRunning = false;
      attempedRoomCode = null;
    }

    waitingCont.style.display = "none";
    scoreCard.style.display = "none";
    joinCodeCont.style.display = "none";

    if (mode === "duo-same") {
      duoLabel.textContent = mode === "duo-same" ? "duo · same word" : "duo · exchange";
      duoChoiceCont.style.display = "flex";

      customWordCardCont.style.display = "none";
      cont.style.display = "none";
    } else if (mode === "duo-exchange") {
      //duoLabel.textContent = mode === "duo-same" ? "duo · same word" : "duo · exchange";
      cont.style.display = "none";

      duoChoiceCont.style.display = "none";
      customWordCardCont.style.display = "inline-block";
    } else {
      duoChoiceCont.style.display = "none";
      if (!isGameRunning) {
        document.getElementById("message").textContent = "come play!";
        messageCont.classList.toggle("show-result");
      }

      customWordCardCont.style.display = "none";
      cont.style.display = "inline-block";
      // show your existing single-player .cont here
    }
  });
});

const customWordInput = document.getElementById("custom-word");
const customHintInput = document.getElementById("custom-hint");

customWordInput.addEventListener("input", () => {
  document.getElementById("wordCount").textContent =
    `${customWordInput.value.length}/20`;
});

customHintInput.addEventListener("input", () => {
  document.getElementById("hintCount").textContent =
    `${customHintInput.value.length}/70`;
});

function cleanSubmittedInfo() {
  const customHint = customHintInput.value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();
  const customWord = customWordInput.value
    .trim()
    .replace(/\s+/g, " ")
    .toLowerCase();

  if (!customWord || !customHint) {
    showToast("please enter a word and hint", "error");
    return;
  }

  if (
    !/^[a-zA-Z]+(?: [a-zA-Z]+)?$/.test(customWord) ||
    !/^[a-zA-Z]+(?: [a-zA-Z]+)?$/.test(customHint)
  ) {
    showToast("only one space and words are allowed", "error");
    return;
  }

  if (
    customWord.length < 3 ||
    customWord.length > 20 ||
    customHint.length < 5 ||
    customHint.length > 80
  ) {
    showToast("invalid input. try again", "error");
    return;
  }

  if (customWord === customHint) {
    showToast("the word can not be the same as the hint", "error");
    return;
  }

  const wordType = customWord.includes(" ") ? "double" : "single";

  return {
    word: customWord,
    hint: customHint,
    wordType,
  };
}

const submitCustomWord = document.getElementById("submit-word-btn");
submitCustomWord.addEventListener("click", (e) => {
  e.preventDefault();

  const info = cleanSubmittedInfo();
  if (!info) return;
  socket.emit("send-custom-info", info, id, RoomCode, playAgainExchange, mode);

  if (!playAgainExchange) {
    customWordCardCont.style.display = "none";
    duoLabel.textContent = "duo · exchange";
    duoChoiceCont.style.display = "flex";
    playAgainExchange = false;
  } else {
    customWordCardCont.style.display = "none";
  }
});

createRoomBtn.addEventListener("click", () => {
  socket.emit("create-room", mode);
});

joinRoomBtn.addEventListener("click", () => {
  duoChoiceCont.style.display = "none";
  joinCodeCont.style.display = "flex";
});

submitCodeBtn.addEventListener("click", () => {
  attempedRoomCode = roomCodeInput.value.trim();
  socket.emit("join-room", attempedRoomCode, mode);

  //for duo mode
  wordCont.innerHTML = "";
  createInnerLoader();
});

backToModesBtn.addEventListener("click", () => {
  duoChoiceCont.style.display = "none";
  document
    .querySelector('.mode-btn[data-mode="singlePlayer"]')
    ?.classList.add("active-mode-btn");
  if (mode === "duo-same") {
    modeButtons[1].classList.remove("active-mode-btn");
  } else if (mode === "duo-exchange") {
    modeButtons[2].classList.remove("active-mode-btn");
  }
  cont.style.display = "inline-block";
});

backToChoiceBtn.addEventListener("click", () => {
  joinCodeCont.style.display = "none";
  duoChoiceCont.style.display = "flex";
});

/*  */

const waitingCont = document.getElementById("waiting-cont");
const waitPopup = document.getElementById("waitPopup");
const roomCodeText = document.getElementById("room-code-text");
const copyCodeBtn = document.getElementById("copy-code-btn");
const cancelRoomBtn = document.getElementById("cancel-room-btn");

// when create-room-btn is clicked, server responds with the code
socket.on("room-created", (roomCode) => {
  showToast(`room code: ${roomCode}`);
  roomCodeText.textContent = roomCode;
  duoChoiceCont.style.display = "none";
  waitingCont.style.display = "flex";
  attempedRoomCode = roomCode;
});

copyCodeBtn.addEventListener("click", () => {
  navigator.clipboard.writeText(roomCodeText.textContent).then(() => {
    showToast("Room code copied");
  });
});

cancelRoomBtn.addEventListener("click", () => {
  socket.emit("cancel-room", roomCodeText.textContent);
  waitingCont.style.display = "none";
  duoChoiceCont.style.display = "flex";
});

// fires once the second player joins
socket.on("match-ready", ({ type, message, code, mode }) => {
  //removing the other containers
  waitingCont.style.display = "none";
  joinCodeCont.style.display = "none";

  if (playAgainExchange === true && mode === "duo-exchange") {
    waitPopup.classList.toggle("hidden" /* , true */);
  }

  // show your game board (.cont) here
  showToast("Opponent joined!", type);
  showToast("Get readly", type);
  //createInnerLoader();
  cont.style.display = "inline-block";

  //for duo mode
  wordCont.innerHTML = "";
  createInnerLoader();

  socket.emit("get-info", code, mode);
});
/*  */

const loader = document.getElementById("loader");
const cont = document.querySelector(".cont");
const chancesCont = document.querySelector(".chances");

setTimeout(() => {
  if (!isDataReceived) {
    loader.style.display = "flex";
  }
}, 5000);

function finishLoading() {
  if (loader) {
    isDataReceived = true;
    loader.style.display = "none";
  }
  chancesCont.style.display = "inline-block";
  cont.style.display = "inline-block";
  joinCodeCont.style.display = "none";
  document.querySelector(".mode-cont").style.display = "flex";
}

function startGame() {
  if (!cleanCont) cleanGameCont();
  isGameRunning = true;

  /* modeButtons.forEach((btn) => {
    btn.disabled = true;
  }) */

  if (innerLoader) {
    innerLoader.style.display = "none";
  }
  if (data.wordType === "double") doubleWords();
  for (let i = 0; i < word.length; i++) {
    const letter = document.createElement("span");
    letter.textContent = "";
    letter.setAttribute("data-letter", word.charAt(i));
    letter.className = "hide";
    if (word.charAt(i) === " ") {
      letter.classList.add("space");
      letter.classList.remove("hide");
      numOfCorrectLetters++;
      subLetters = secondWordLetters;
    }
    if (twoWords) {
      subLetters.push(letter);
    }
    wordCont.appendChild(letter);
  }
  secondWordLetters.shift();
}

function doubleWords() {
  twoWords = true;
  firstWord = word.slice(0, word.indexOf(" "));
  secondWord = word.slice(word.indexOf(" ") + 1);
}

const letterInput = document.getElementById("input-field");
const submitBtn = document.getElementById("submit-btn");
const attemptedLettersCont = document.querySelector(".attempted-letters");
const messageCont = document.getElementById("message-cont");
let attemptedLetters = new Array();
const chances = document.getElementById("number-of-chances");
let numOfAttempts = 7;

submitBtn.addEventListener("click", (e) => {
  e.preventDefault();
  submitLetter();
});
//submitBtn.addEventListener("click", submitLetter);

letterInput.focus();
function submitLetter() {
  const value = letterInput.value.replace(/\s+/g, " ").trim().toLowerCase();
  if (letterInput.value.trim().length < 1 || letterInput.value.trim().length === 2 || attemptedLetters.includes(value)) {
    letterInput.value = "";
    return;
  }
  if (!/^[A-Za-z\s]+$/.test(letterInput.value.trim())) {
    showToast("only enter letters!", "info");
    letterInput.value = "";
    return;
  }
  attemptedLetters.push(value);

  //if (numOfAttempts) letterInput.focus();
  if (word.includes(value)) {
    if (/* letterInput.value.trim() */ value.length === 1) {
      document.querySelectorAll(".hide").forEach((e) => {
        if (e.classList.contains("show")) return;
        if (
          e.getAttribute("data-letter") ===
          value /* letterInput.value.trim().toLowerCase() */
        ) {
          e.textContent = e.getAttribute("data-letter");
          e.classList.add("show");
          numOfCorrectLetters++;
        }
      });
      const letter = document.createElement("span");
      letter.textContent = value /* letterInput.value.trim().toLowerCase() */;
      letter.className = "correct-letter";
      attemptedLettersCont.appendChild(letter);
      checkIfCorrect();
    } else {
      if (value === word) {
        document.querySelectorAll(".hide").forEach((e) => {
          e.textContent = e.getAttribute("data-letter");
          e.classList.add("show");
        });
        const letter = document.createElement("span");
        letter.textContent = value /* letterInput.value.trim().toLowerCase() */;
        letter.className = "correct-letter";
        attemptedLettersCont.appendChild(letter);

        submitBtn.removeEventListener("click", submitLetter);
        document.getElementById("message").textContent = "you win!!!";
        messageCont.classList.toggle("show-result");
        triggerWin();
        playAgainBtn.focus();
      } else if (value === firstWord || value === secondWord) {
        //let subWord = value === firstWord? firstWord: secondWord;
        subLetters = value === firstWord ? firstWordLetters : secondWordLetters;
        subLetters.forEach((e) => {
          e.textContent = e.getAttribute("data-letter");
          e.classList.add("show");
          numOfCorrectLetters++;
        });

        const letter = document.createElement("span");
        letter.textContent = letterInput.value.trim().toLowerCase();
        letter.className = "correct-letter";
        attemptedLettersCont.appendChild(letter);

        let num = 0;
        document.querySelectorAll(".hide").forEach((e) => {
          if (e.classList.contains("show")) {
            num++;
          }
          checkIfWon(num);
        });
      } else {
        const letter = document.createElement("span");
        letter.textContent = letterInput.value.trim().toLowerCase();
        letter.className = "wrong-letter";
        attemptedLettersCont.appendChild(letter);
      }
    }
  } else {
    numOfAttempts--;
    chances.textContent = numOfAttempts;
    if (numOfAttempts <= 2) chances.style.color = "#f70909";
    const letter = document.createElement("span");
    letter.textContent = letterInput.value.trim().toLowerCase();
    letter.className = "wrong-letter";
    attemptedLettersCont.appendChild(letter);
    if (numOfAttempts === 1)
      document.getElementById("hint").textContent = `hint: ${hint}`;
    if (numOfAttempts === 0) {
      submitBtn.removeEventListener("click", submitLetter);
      if (mode === "duo-same" || mode === "duo-exchange") {
        if (!isTimerActive) {
          playAgainBtn.disabled = true;

          setTimeout(() => {
            playAgainBtn.disabled = false;
            playAgainBtn.focus();
          }, 21000);
        }

        if (isTimerActive) {
          clearInterval(startTime);
          isTimerActive = false;
          time = 20;
          TimeCont.style.display = "none";
          timerCont.textContent = time;
        }
        socket.emit("you-lost", id, attempedRoomCode, mode);
      } else {
        isGameRunning = false;
        modeButtons.forEach((btn) => {
          btn.disabled = false;
        });
      }
      cleanCont = false;
      document.getElementById("message").textContent = "you lose!!!";
      messageCont.classList.toggle("show-result");
      playAgainBtn.focus();
    }
  }
  letterInput.value = "";
}

function checkIfWon(num) {
  if (document.querySelectorAll(".hide").length === num) {
    submitBtn.removeEventListener("click", submitLetter);
    document.getElementById("message").textContent =
      "congratulations, you win!!!";
    messageCont.classList.toggle("show-result");

    triggerWin();
    playAgainBtn.focus();
  }
}

function checkIfCorrect() {
  if (numOfCorrectLetters === word.length) {
    submitBtn.removeEventListener("click", submitLetter);
    document.getElementById("message").textContent =
      "congratulations, you win!!!";
    messageCont.classList.toggle("show-result");

    triggerWin();
    playAgainBtn.focus();
  }
}

function triggerWin() {
  if (mode === "duo-same" || mode === "duo-exchange") {
    if (mode === "duo-exchange" && !isTimerActive) {
      playAgainBtn.disabled = true;

      setTimeout(() => {
        playAgainBtn.disabled = false;
        playAgainBtn.focus();
      }, 21000);
    } //can be combined

    if (isTimerActive) {
      clearInterval(startTime);
      isTimerActive = false;
      time = 20;
      TimeCont.style.display = "none";
      timerCont.textContent = time;
      showToast("you won within 20s");
    }
    const points = numOfAttempts === 7 ? 3 : 1;
    socket.emit("won", RoomCode, id, mode, points);

    showToast("congratulations, you win!🥳🎉", "success");
  } else {
    isGameRunning = false;
    modeButtons.forEach((btn) => {
      btn.disabled = false;
    });
  }
  cleanCont = false;
}

function cleanGameCont() {
  if (twoWords) {
    firstWord = "";
    secondWord = "";
    firstWordLetters = new Array();
    secondWordLetters = new Array();
    subLetters = firstWordLetters;
    twoWords = false;
  }
  numOfAttempts = 7;
  numOfCorrectLetters = 0;
  chances.textContent = numOfAttempts;
  attemptedLetters = new Array();
  attemptedLettersCont.innerHTML = "";
  document.getElementById("hint").textContent = "";
  wordCont.innerHTML = "";
  createInnerLoader();

  submitBtn.addEventListener("click", submitLetter);
  canRequestWord = true;
  cleanCont = true;
  letterInput.focus();
}

const playAgainBtn = document.getElementById("play-again-btn");
playAgainBtn.addEventListener("click", () => {
  chances.style.color = "#0fe32b";
  messageCont.classList.toggle("show-result");
  if (twoWords) {
    firstWord = "";
    secondWord = "";
    firstWordLetters = new Array();
    secondWordLetters = new Array();
    subLetters = firstWordLetters;
    twoWords = false;
  }
  numOfAttempts = 7;
  numOfCorrectLetters = 0;
  chances.textContent = numOfAttempts;
  attemptedLetters = new Array();
  attemptedLettersCont.innerHTML = "";
  document.getElementById("hint").textContent = "";
  wordCont.innerHTML = "";
  createInnerLoader();

  if (canRequestWord) {
    if (mode === "duo-same") {
      socket.emit("clean", RoomCode, id, "duo-same-play-again");
      socket.emit("get-info", RoomCode, mode);
    } else if (mode === "duo-exchange") {
      socket.emit("clean", RoomCode, id, "duo-exchange-play-again");

      //messageCont.classList.toggle("show-result");
      cont.style.display = "none";
      playAgainExchange = true;
      customWordCardCont.style.display = "inline-block";

      //------------------need to work on this
      //socket.emit("get-info", RoomCode, mode);
    } else {
      requestWord(id);
    }
  }
  submitBtn.addEventListener("click", submitLetter);
  canRequestWord = true;
  cleanCont = true;
  letterInput.focus();
});

function createInnerLoader() {
  const innerLoaderCont = document.createElement("div");
  innerLoaderCont.className = "loader";
  innerLoaderCont.id = "inner-loader";

  for (let i = 1; i <= 4; i++) {
    const div = document.createElement("div");
    div.className = "circle";

    const dot = document.createElement("div");
    dot.className = "dot";

    const outline = document.createElement("div");
    outline.className = "outline";

    div.appendChild(dot);
    div.appendChild(outline);
    innerLoaderCont.appendChild(div);
  }
  wordCont.appendChild(innerLoaderCont);
  innerLoader = innerLoaderCont; // document.getElementById("inner-loader");
}

const splash = document.getElementById("duelixSplash");

if (sessionStorage.getItem("duelixIntroShown")) {
  splash.remove();
} else {
  sessionStorage.setItem("duelixIntroShown", "true");
}
