
let words = [];
async function fetchWords() {
    try {
        const API = "https://lexora-words-api.onrender.com/words";
      const res = await fetch(API);
      words = await res.json();
      return words;
      
    } catch (err) {
      console.error({success:  false, message: `error fetching data: ${err}`});
      console.error(`cause: ${err.cause}`);
      
      return words;
    }
}


async function getWord() {
    if (!words) {
        words = await fetchWords();
    } 
    //console.log(`length ${words.length}`);
    
    const randomWordIndex = Math.floor(Math.random() * words.length);
    const word = words[randomWordIndex].word;
    const hint = words[randomWordIndex].hint;
    let wordType = word.includes(" ")? "double": "single";
    
    return {
        word,
        hint,
        wordType
    }
}

module.exports = {getWord}
