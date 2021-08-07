const express = require('express');
const language = require('@google-cloud/language');
let router = express.Router();

router.use(function(req, res, next) {
  res.header('Access-Control-Allow-Origin', '*'); // update to match the domain you will make the request from
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

router.post('/', async (req, res, next) => {

  let { questions, text } = req.body;

  let relevances = await getRelevances(questions, text);
  res.json({ length: relevances.length, relevances });
});

// input: list of question-answer pairs
// output: list of question-answer-relevance tuples
const getRelevances = async (questionAnswerList, text) => {

  let keywords = (await getKeywords(text));

  let relevances = new Promise((resolve) => {
    let ret = questionAnswerList.map(({ answer, question }) => {
      return { question, answer, relevance: relevance(question, answer, keywords) };
    });
    ret.sort((a, b) => b.relevance - a.relevance); // sort by relevance (descending)
    resolve(ret);
  });
  
  return (await relevances);
} 

const getKeywords = async (text) => {

  const client = new language.LanguageServiceClient();
  const document = {
    content: text,
    type: 'PLAIN_TEXT',
  };
  const [result] = await client.analyzeEntities({ document });

  // Convert keywords to lowercase.
  // Combine duplicate keywords.
  // Return as object with names as keys. 
  return result.entities.reduce((acc, { name, salience }) => {
    acc[name.toLowerCase()] = {
      salience: (acc.hasOwnProperty(name) ? acc[name].salience : 0) + salience
    };
    return acc;
  }, {});
}

// input: question, answer, and list of keywords
// output: relevance rating for question and answer
//    --> based on number of keywords in question AND answer
const relevance = (question, answer, keywords) => {

  const strength = (words) => {
    return Object.keys(keywords).reduce((acc, phrase) => {
      let includesPhrase = phrase.split(' ').reduce((acc, word) => acc || words.includes(word), false);  // Check if any keyword in phrase matches words.
      return acc + (includesPhrase ? keywords[phrase].salience : 0);
    }, 0);
  }

  const punctuationRegex = new RegExp(/[;:,.?!\/"#\s]+/);
  let words = (question + '#' + answer).toLowerCase().split(punctuationRegex);  // Split by punctuation and spaces.
  return strength(words);
}

// TODO?: return top x% of questions to client

module.exports = router;
