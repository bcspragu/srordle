// Package trie provides a somewhat efficient data structure for storing a
// dictionary and verifying if words are in it.
package trie

import (
	"bufio"
	"fmt"
	"io"
	"unicode"
	"unicode/utf8"
)

const letters = 26

var (
	// noRune represents the zero value of a rune. It's unclear if we'll actually
	// need this, but we'll see.
	noRune rune
	// aValue is the integer value of a encoded as a big endian number.
	aValue int
)

func init() {
	var a [1]byte
	if n := utf8.EncodeRune(a[:], 'a'); n != 1 {
		panic(fmt.Sprintf("wrote %d bytes for 'a', wanted one", n))
	}
	aValue = int(a[0])
}

// New returns a *Trie initialized with the newline-delimited words in the
// given io.Reader.
func New(r io.Reader) (*Trie, error) {
	trie := new(Trie)

	sc := bufio.NewScanner(r)
	for sc.Scan() {
		trie.addWord(sc.Text())
	}

	if err := sc.Err(); err != nil {
		return nil, fmt.Errorf("failed to scan file: %v", err)
	}

	return trie, nil
}

type node struct {
	// leaf is true if this node marks the end of a full word.
	leaf bool
	// letter is what letter we actually represent.
	letter   rune
	children [letters]*node
}

// Trie implements a trie data structure over ASCII words.
type Trie struct {
	roots [letters]*node
	size  int
}

func checkInput(in string) error {
	for i, r := range in {
		if n := utf8.RuneLen(r); n != 1 {
			return fmt.Errorf("rune at index %d in string %q would require %d bytes to encode", i, in, n)
		}
		if !unicode.IsLower(r) {
			return fmt.Errorf("rune at index %d in string %q is not lowercase", i, in)
		}
	}
	return nil
}

// Size returns the total size (in words) of the trie.
func (t *Trie) Size() int {
	return t.size
}

// HasWord trues true if the given input was found in the dictionary, and also
// returns its index.
func (t *Trie) HasWord(in string) (bool, error) {
	if err := checkInput(in); err != nil {
		return false, err
	}

	nodes := t.roots
	n := utf8.RuneCountInString(in)

	// Iterate over the letters in the input word.
	for i, r := range in {
		node := nodes[toIndex(r)]

		// We didn't hav a filled out node, so that word isn't in our set.
		if node == nil {
			return false, nil
		}

		if i == n-1 {
			return node.leaf, nil
		}

		// Now check the next layer for the next letter.
		nodes = node.children
	}

	return false, nil
}

func (t *Trie) addWord(in string) error {
	if err := checkInput(in); err != nil {
		return err
	}

	curNodes := &t.roots
	n := utf8.RuneCountInString(in)

	for i, r := range in {
		idx := toIndex(r)
		curNode := curNodes[idx]

		// If the node doesn't exist, add it.
		if curNode == nil {
			curNode = &node{letter: r}
			curNodes[idx] = curNode
		}

		// Now check the next layer.
		curNodes = &curNode.children

		if i == n-1 {
			curNode.leaf = true
		}
	}

	return nil
}

// toIndex returns the input rune shifted to an array index. For example, 'a'
// maps to 0, 'e' maps to 4, and 'z' maps to 25. This function assumes you've
// already verified that the rune can be safely encoded in one byte and is a
// lowercase letter, e.g. using the checkInput function.
func toIndex(r rune) int {
	var dat [1]byte
	if n := utf8.EncodeRune(dat[:], r); n != 1 {
		panic(fmt.Sprintf("wrote %d bytes for rune %v, wanted one", n, r))
	}
	return int(dat[0]) - aValue
}
