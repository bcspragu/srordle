package trie

import (
	"bufio"
	"log"
	"os"
	"testing"
)

func TestTrie(t *testing.T) {
	trie := setup(t)

	f, err := os.Open("../wordlists/dict.txt")
	if err != nil {
		log.Fatalf("failed to open word list: %v", err)
	}
	defer f.Close()
	sc := bufio.NewScanner(f)

	dict := make([]string, 0, 370000 /* roughly the size of the word list */)
	for sc.Scan() {
		dict = append(dict, sc.Text())
	}
	if err := sc.Err(); err != nil {
		t.Fatalf("failed to load word list: %v", err)
	}

	for _, word := range dict {
		found, err := trie.HasWord(word)
		if err != nil {
			t.Fatalf("trie.HasWord(%q): %v", word, err)
		}
		if !found {
			// Note: We Fatal() here instead of Error() to avoid printing out like
			// 370,000 error lines if sokmething goes wrong.
			t.Fatalf("word %q was not found in trie", word)
		}
	}

	notWords := []string{
		"aar",
		"aard",
		"aardv",
		"aardva",
		"aardvar",
		"lk",
		"pv",
		"lsiouwer",
		"bargtaio",
		"iqlkasd",
		"cattrea",
		"muffinia",
		"stunnuffle",
		"stromblinger",
	}

	for _, notWord := range notWords {
		found, err := trie.HasWord(notWord)
		if err != nil {
			t.Fatalf("trie.HasWord(%q): %v", notWord, err)
		}
		if found {
			t.Errorf("word %q was found in trie, but its not real", notWord)
		}
	}
}

func setup(t *testing.T) *Trie {
	f, err := os.Open("../wordlists/dict.txt")
	if err != nil {
		log.Fatalf("failed to open word list: %v", err)
	}
	defer f.Close()

	trie, err := New(f)
	if err != nil {
		t.Fatalf("New(): %v", err)
	}

	return trie
}
