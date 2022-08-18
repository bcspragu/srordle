package srordle

import "time"

type LetterAnswer struct {
	Letter string
	Status LetterStatus
}

type LetterStatus int

const (
	UnknownLetterStatus LetterStatus = iota
	NotInWord
	WrongPosition
	Correct
	PositionNotUsed
)

type Guess struct {
	Words         []string
	GuessedAt     time.Time
	RequestedFull bool
}

type Game struct {
	TargetWord   string
	Shape        Shape
	FullAttempts int
}

type Row []bool

func (r Row) ToTargetWordLengths() []int {
	curRun := 0
	out := []int{}
	for _, v := range r {
		if v {
			curRun++
		} else if curRun > 0 {
			out = append(out, curRun)
			curRun = 0
		}
	}
	// Add the last one if one is still open.
	if curRun > 0 {
		out = append(out, curRun)
	}
	return out
}

func (r Row) toStartOffsets() []int {
	inWord := false
	out := []int{}
	for i, v := range r {
		if v && !inWord {
			out = append(out, i)
		}
		inWord = v
	}
	return out
}

func (r Row) SplitGuess(in string) ([]string, bool) {
	var (
		words [][]rune

		guessIdx = 0
		prev     = false
		inRune   = []rune(in)
	)
	for _, v := range r {
		if v {
			// This means the word was the wrong length.
			if guessIdx >= len(inRune) {
				return nil, false
			}
			if !prev {
				// Start of a new word.
				words = append(words, []rune{inRune[guessIdx]})
			} else {
				// Append to the existing word.
				words[len(words)-1] = append(words[len(words)-1], inRune[guessIdx])
			}
			guessIdx++
		}
		prev = v
	}

	var out []string
	for _, rs := range words {
		out = append(out, string(rs))
	}
	return out, true
}

type Shape []Row

func DefaultShape() Shape {
	t, f := true, false
	return []Row{
		{t, t, t, t, t, t, t},
		{t, t, t, t, f, t, t},
		{t, t, t, f, t, t, t},
		{t, t, f, t, t, t, t},
		{f, f, t, t, t, f, f},
		{f, t, t, t, t, t, f},
	}
}

func (g *Game) Clone() *Game {
	if g == nil {
		return nil
	}

	return &Game{
		TargetWord:   g.TargetWord,
		Shape:        g.Shape,
		FullAttempts: g.FullAttempts,
	}
}

func (g *Game) foundTarget(guesses []Guess) bool {
	for _, gs := range guesses {
		if len(gs.Words) == 1 && gs.Words[0] == g.TargetWord {
			return true
		}
	}
	return false
}

func (g *Game) targetFreq() map[rune]int {
	out := make(map[rune]int)
	for _, l := range g.TargetWord {
		out[l]++
	}
	return out
}

func (g *Game) CalcAnswer(guesses []string, r Row) []LetterAnswer {
	var (
		las []LetterAnswer

		freq = g.targetFreq()
		trs  = []rune(g.TargetWord)
	)

	startOffsets := r.toStartOffsets()

	// First, just populate the guesses.
	for range trs {
		las = append(las, LetterAnswer{
			Letter: "",
			Status: PositionNotUsed,
		})
	}

	for i, guess := range guesses {
		for j, l := range guess {
			idx := j + startOffsets[i]
			las[idx].Letter = string(l)
			las[idx].Status = NotInWord
		}
	}

	// Then, find the correct ones.
	for i, guess := range guesses {
		for j, l := range guess {
			idx := j + startOffsets[i]
			if l != trs[idx] {
				continue
			}
			las[idx].Status = Correct
			freq[l]--
		}
	}

	// Last, find the misplaced ones
	for i, guess := range guesses {
		for j, l := range guess {
			idx := j + startOffsets[i]
			if freq[l] <= 0 || las[idx].Status == Correct {
				continue
			}
			las[idx].Status = WrongPosition
			freq[l]--
		}
	}

	return las
}
