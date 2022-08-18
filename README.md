# Srordle

Srordle is a (bad) variation of Wordle built for a friend's birthday. It uses
7-letter words, and guesses are **subsets** of those 7-letters, sometimes
multiple words.

## Development

We use `make` as a task running for development. Make sure you have functioning
environments for both Node/npm and Go, then run:

* `make frontend-run` - Runs our frontend watcher, which will automatically compile TS + include Node modules
* `make backend-run` - Runs the backend in dev mode, which serves static assets

Run `make` with no arguments to see a list of all options.

## TODO

* [x] Finish refactoring this for general, public use
* [ ] Add more words to `wordlists/target.txt`
  * I was manually removing proper nouns from a list of popular words, and got tired after about ~2000 words
* [ ] Sanity check that all words in `wordlists/target.txt` are valid dictionary words
  * Filter out the ones that aren't, or add them to the dictionary (`wordlists/dict.txt`)
