package main

import (
	"bufio"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"log"
	"math/rand"
	"net/http"
	"os"
	"strings"
	"time"
	"unicode/utf8"

	"github.com/bcspragu/srordle/db"
	"github.com/bcspragu/srordle/srordle"
	"github.com/bcspragu/srordle/trie"
)

func main() {
	if err := run(); err != nil {
		log.Fatalf("run: %v", err)
	}
}

type Dictionary interface {
	HasWord(in string) (bool, error)
}

type Answer struct {
	LetterAnswers []srordle.LetterAnswer
	RequestedFull bool
}

type server struct {
	dict           Dictionary
	isLocal        bool
	allTargetWords []string
	r              *rand.Rand
	db             *db.DB
}

func run() error {
	var (
		isLocal         = flag.Bool("local", true, "If true, serve /images and compiled artifacts")
		dictPath        = flag.String("dictionary_path", "wordlists/dict.txt", "The file containing valid dictionary words.")
		targetWordsPath = flag.String("target_words_path", "wordlists/target.txt", "The file containing solution words.")
		dbDir           = flag.String("db_dir", ".badger", "The directory for the Badger database")
	)
	flag.Parse()

	trie, err := loadTrie(*dictPath)
	if err != nil {
		return fmt.Errorf("failed to load trie: %w", err)
	}

	targetWords, err := loadTargetWords(*targetWordsPath)
	if err != nil {
		return fmt.Errorf("failed to load target words: %w", err)
	}

	db, err := db.Open(*dbDir)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer db.Close()

	srv := &server{
		isLocal:        *isLocal,
		dict:           trie,
		allTargetWords: targetWords,
		r:              rand.New(rand.NewSource(time.Now().UnixNano())),
		db:             db,
	}

	mux := http.NewServeMux()
	if *isLocal {
		mux.HandleFunc("/", srv.serveHTML)
	}
	mux.HandleFunc("/api/guess", srv.serveGuess)
	mux.HandleFunc("/api/srordle", srv.serveSrordle)

	if err := http.ListenAndServe(":8000", recoverWrap(mux)); err != nil {
		return fmt.Errorf("http.ListenAndServe: %w", err)
	}
	return nil
}

func (s *server) serveHTML(w http.ResponseWriter, r *http.Request) {
	switch r.URL.Path {
	case "/", "/index.html":
		http.ServeFile(w, r, "dist/index.html")
		return
	case "/index.js":
		http.ServeFile(w, r, "dist/index.js")
		return
	case "/index.css":
		http.ServeFile(w, r, "dist/index.css")
		return
	}

	if s.isAsset(r.URL.Path) && s.isLocal {
		http.ServeFile(w, r, strings.TrimPrefix(r.URL.Path, "/"))
		return
	}

	httpError(w, http.StatusNotFound, "path %q either not found or not allowed", r.URL.Path)
}

func (s *server) isAsset(p string) bool {
	return strings.HasPrefix(p, "/images/")
}

func httpError(w http.ResponseWriter, code int, format string, args ...any) {
	log.Printf(format, args...)
	http.Error(w, http.StatusText(code), code)
}

func (s *server) serveGuess(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpError(w, http.StatusMethodNotAllowed, "invalid method %q", r.Method)
		return
	}

	var req struct {
		Guess    string `json:"guess"`
		TZOffset int    `json:"tzOffset"`

		// Only one of these needs to be set.
		GuessIndex int  `json:"guessIndex"`
		UseFull    bool `json:"useFull"`
	}
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, http.StatusBadRequest, "failed to parse request: %v", err)
		return
	}

	gameDate := db.ToDate(time.Now().In(time.FixedZone("UserTZ", req.TZOffset)))
	game, err := s.db.Game(gameDate)
	if err != nil {
		httpError(w, http.StatusInternalServerError, "failed to load game: %v", err)
		return
	}

	errorRespf := func(fmtStr string, args ...interface{}) {
		jsonResp(w, struct {
			Error string
		}{fmt.Sprintf(fmtStr, args...)})
	}

	var (
		targetWordLens []int
		row            srordle.Row
		guesses        []string
	)
	req.Guess = strings.ToLower(req.Guess)
	if req.UseFull || req.GuessIndex >= len(game.Shape) {
		targetWordLens = []int{7}
		row = srordle.Row([]bool{true, true, true, true, true, true, true})
		guesses = []string{req.Guess}
	} else if req.GuessIndex < len(game.Shape) {
		row = game.Shape[req.GuessIndex]
		targetWordLens = row.ToTargetWordLengths()
		var ok bool
		guesses, ok = row.SplitGuess(req.Guess)
		if !ok {
			errorRespf("Your guess wasn't the right shape")
			return
		}
	} else {
		errorRespf("Invalid guess index given")
		return
	}

	if len(guesses) != len(targetWordLens) {
		errorRespf("Wanted %d guesses, got %d", len(targetWordLens), len(guesses))
		return
	}

	var invalidWords []string
	for i, guess := range guesses {
		if utf8.RuneCountInString(guess) != targetWordLens[i] {
			errorRespf("%s isn't %d letters long", guess, targetWordLens[i])
			return
		}

		ok, err := s.dict.HasWord(guess)
		if err != nil {
			httpError(w, http.StatusInternalServerError, "failed to look in dictionary for %q: %v", guess, err)
			return
		}
		if !ok {
			invalidWords = append(invalidWords, guess)
		}
	}

	switch len(invalidWords) {
	case 0:
		// All good
	case 1:
		errorRespf("%s isn't a word", strings.ToUpper(invalidWords[0]))
		return
	case 2:
		errorRespf("Neither of those are real words")
		return
	}

	jsonResp(w, struct {
		Answer []srordle.LetterAnswer
		Won    bool
		Words  []string
	}{
		Answer: game.CalcAnswer(guesses, row),
		Won:    len(guesses) == 1 && guesses[0] == game.TargetWord,
		Words:  guesses,
	})
}

func (s *server) serveSrordle(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		httpError(w, http.StatusMethodNotAllowed, "invalid method %q", r.Method)
		return
	}

	var req struct {
		TZOffset int `json:"tzOffset"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		httpError(w, http.StatusBadRequest, "failed to parse request: %v", err)
		return
	}

	gameDate := db.ToDate(time.Now().In(time.FixedZone("UserTZ", req.TZOffset)))
	game, err := s.db.Game(gameDate)
	if err != nil {
		httpError(w, http.StatusInternalServerError, "failed to load game: %v", err)
		return
	}

	// Because we still have a server/client model unlike Wordle/Quordle, so for
	// now, the client shouldn't see the answer.
	game.TargetWord = ""

	jsonResp(w, struct {
		Game *srordle.Game
	}{game})
}

func jsonResp(w http.ResponseWriter, v interface{}) {
	if err := json.NewEncoder(w).Encode(v); err != nil {
		log.Printf("jsonResp: %v", err)
	}
}

func loadTrie(fn string) (*trie.Trie, error) {
	f, err := os.Open(fn)
	if err != nil {
		return nil, fmt.Errorf("failed to open word list: %w", err)
	}
	defer f.Close()

	trie, err := trie.New(f)
	if err != nil {
		return nil, fmt.Errorf("failed to load trie: %w", err)
	}

	return trie, nil
}

func loadTargetWords(fn string) ([]string, error) {
	f, err := os.Open(fn)
	if err != nil {
		return nil, fmt.Errorf("failed to open word list: %w", err)
	}
	defer f.Close()

	var out []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		out = append(out, sc.Text())
	}

	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("failed to scan file: %w", err)
	}

	return out, nil
}

func recoverWrap(h http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		defer func() {
			rcvr := recover()
			if rcvr == nil {
				return
			}
			var err error
			switch t := rcvr.(type) {
			case string:
				err = errors.New(t)
			case error:
				err = t
			default:
				err = fmt.Errorf("unknown error had type %T: %v", r, r)
			}
			log.Printf("PANIC on handler %s: %v", r.URL.Path, err)
			http.Error(w, http.StatusText(http.StatusInternalServerError), http.StatusInternalServerError)
		}()
		h.ServeHTTP(w, r)
	})
}