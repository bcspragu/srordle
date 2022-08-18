package db

import (
	"bytes"
	"encoding/gob"
	"errors"
	"fmt"
	"time"

	"github.com/bcspragu/srordle/srordle"
	"github.com/dgraph-io/badger/v3"
)

type DB struct {
	db *badger.DB
}

type Date struct {
	Year  int32
	Month time.Month
	Day   int8
}

func ToDate(t time.Time) Date {
	return Date{
		Year:  int32(t.Year()),
		Month: t.Month(),
		Day:   int8(t.Day()),
	}
}

func gameKey(d Date) []byte {
	return append([]byte("game:"), d.asBytes()...)
}

func (d Date) AddDays(n int) Date {
	t := time.Date(int(d.Year), d.Month, int(d.Day)+n, 0, 0, 0, 0, time.UTC)
	return ToDate(t)
}

func (d Date) asBytes() []byte {
	return []byte{
		byte((d.Year << 24) & 0xFF),
		byte((d.Year << 16) & 0xFF),
		byte((d.Year << 8) & 0xFF),
		byte((d.Year) & 0xFF),
		byte(d.Month),
		byte(d.Day),
	}
}

func Open(dir string) (*DB, error) {
	db, err := badger.Open(badger.DefaultOptions(dir))
	if err != nil {
		return nil, fmt.Errorf("failed to open database: %w", err)
	}

	return &DB{db: db}, nil
}

func (d *DB) Close() error {
	return d.db.Close()
}

func (d *DB) AddGame(date Date, game *srordle.Game) error {
	var buf bytes.Buffer
	if err := gob.NewEncoder(&buf).Encode(game); err != nil {
		return fmt.Errorf("failed to gob encode game: %w", err)
	}

	txn := d.db.NewTransaction(true) // Read-write txn
	defer txn.Commit()               // Best effort commit on failure

	if err := txn.SetEntry(badger.NewEntry(gameKey(date), buf.Bytes())); err != nil {
		return fmt.Errorf("failed to set entry in transaction: %w", err)
	}

	if err := txn.Commit(); err != nil {
		return fmt.Errorf("failed to commit transaction: %w", err)
	}

	return nil
}

type errGameNotFound struct{}

func (errGameNotFound) Error() string {
	return "game not found"
}

func (d *DB) Game(date Date) (*srordle.Game, error) {
	txn := d.db.NewTransaction(false)
	defer txn.Commit() // Best effort commit on failure

	item, err := txn.Get(gameKey(date))
	if errors.Is(err, badger.ErrKeyNotFound) {
		return nil, errGameNotFound{}
	} else if err != nil {
		return nil, fmt.Errorf("failed to load game bytes: %w", err)
	}

	var g *srordle.Game
	err = item.Value(func(val []byte) error {
		if err := gob.NewDecoder(bytes.NewReader(val)).Decode(&g); err != nil {
			return fmt.Errorf("failed to gob decode game: %w", err)
		}
		return nil
	})
	if err != nil {
		return nil, fmt.Errorf("failed to load item value: %w", err)
	}

	if err := txn.Commit(); err != nil {
		return nil, fmt.Errorf("failed to commit transaction: %w", err)
	}

	return g, nil
}
