package main

import (
	"bufio"
	"fmt"
	"math/rand"
	"os"
	"time"

	"github.com/alecthomas/kong"
	"github.com/bcspragu/srordle/db"
	"github.com/bcspragu/srordle/srordle"
)

type Context struct {
	Debug bool
}

type PopulateCmd struct {
	DatabasePath    string `arg:"" name:"database path" help:"Path to the BadgerDB database directory." type:"path"`
	TargetWordsPath string `arg:"" name:"target words path" help:"Path to the wordlist to use for the game." type:"path"`
}

func (p *PopulateCmd) Run(ctx *Context) error {
	bdb, err := db.Open(p.DatabasePath)
	if err != nil {
		return fmt.Errorf("failed to open database: %w", err)
	}
	defer bdb.Close()

	f, err := os.Open(p.TargetWordsPath)
	if err != nil {
		return fmt.Errorf("failed to open word list: %w", err)
	}
	defer f.Close()

	var words []string
	sc := bufio.NewScanner(f)
	for sc.Scan() {
		words = append(words, sc.Text())
	}
	r := rand.New(rand.NewSource(0))
	order := r.Perm(len(words))

	dt := db.ToDate(time.Now().AddDate(0, 0, -1))
	for _, idx := range order {
		err = bdb.AddGame(dt, &srordle.Game{
			TargetWord:   words[idx],
			FullAttempts: 2,
			Shape:        srordle.DefaultShape(),
		})
		if err != nil {
			return fmt.Errorf("failed to create game: %w", err)
		}
		dt = dt.AddDays(1)
	}

	if err := sc.Err(); err != nil {
		return fmt.Errorf("failed to scan wordlist file: %w", err)
	}

	if err := f.Close(); err != nil {
		return fmt.Errorf("failed to close wordlist file: %w", err)
	}

	return nil
}

var cli struct {
	Debug bool `help:"Enable debug mode."`

	Populate PopulateCmd `cmd:"" help:"Populate the database with games"`
}

func main() {
	ctx := kong.Parse(&cli)
	err := ctx.Run(&Context{Debug: cli.Debug})
	ctx.FatalIfErrorf(err)
}
