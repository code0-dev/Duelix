
/* let words = [];
=======
let words = [];
>>>>>>> 41867de2b00f4f40d69bfc1008983f225acb8174

async function fetchWords() {
    try {
        const API = "https://lexora-words-api.onrender.com/words";

        const res = await fetch(API);

        // Check HTTP status before trying to parse JSON
        if (!res.ok) {
            throw new Error(`Word API returned ${res.status}: ${res.statusText}`);
        }

        const data = await res.json();

        // Make sure we actually received an array
        if (!Array.isArray(data) || data.length === 0) {
            throw new Error("Word API returned an empty or invalid word list");
        }

        words = data;

        console.log(`Loaded ${words.length} words`);

        return words;

    } catch (err) {
        console.error("Failed to fetch words:", err.message);

        return [];
    }
}


async function getWord() {

    // Fetch if we don't currently have words
    if (words.length === 0) {
        await fetchWords();
    }

    // Don't let an empty API response crash the server
    if (words.length === 0) {
        throw new Error("No words are currently available");
    }

    const randomWordIndex = Math.floor(Math.random() * words.length);

    const word = words[randomWordIndex].word;
    const hint = words[randomWordIndex].hint;

    const wordType = word.includes(" ") ? "double" : "single";

    return {
        word,
        hint,
        wordType
    };
<<<<<<< HEAD
}
 */

const fs = require("fs");
const path = require("path");

const wordsPath = path.join(__dirname, "words.json");

function getWord() {
    const words = JSON.parse(
        fs.readFileSync(wordsPath, "utf8")
    );

    if (!Array.isArray(words) || words.length === 0) {
        throw new Error("words.json is empty or invalid");
    }

    const randomIndex = Math.floor(Math.random() * words.length);
    const word = words[randomIndex].word;
    const hint = words[randomIndex].hint;

    const wordType = word.includes(" ")? "double": "single";

    return {
        word,
        hint,
        wordType
    };
}

//module.exports = { getRandomWord };


module.exports = { getWord };

