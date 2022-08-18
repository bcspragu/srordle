package main

import (
	"testing"

	"github.com/google/go-cmp/cmp"
)

func TestToTargetWordLengths(t *testing.T) {
	shape := defaultShape()

	wantPerRow := [][]int{
		{7},
		{4, 2},
		{3, 3},
		{2, 4},
		{3},
		{5},
	}

	for i, row := range shape {
		got := row.toTargetWordLengths()
		want := wantPerRow[i]
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("unexpected target word lengths (-want +got)\n%s", diff)
		}
	}
}

func TestSplitGuess(t *testing.T) {
	shape := defaultShape()

	inPerRow := []string{
		"detract",
		"testin",
		"catdog",
		"onstop",
		"pet",
		"guess",
	}

	wantPerRow := [][]string{
		{"detract"},
		{"test", "in"},
		{"cat", "dog"},
		{"on", "stop"},
		{"pet"},
		{"guess"},
	}

	for i, row := range shape {
		got, ok := row.splitGuess(inPerRow[i])
		if !ok {
			t.Fatalf("row.splitGuess was not ok for %q", inPerRow[i])
		}
		want := wantPerRow[i]
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("unexpected target word lengths (-want +got)\n%s", diff)
		}
	}
}

func TestToStartOffsets(t *testing.T) {
	shape := defaultShape()

	wantPerRow := [][]int{
		{0},
		{0, 5},
		{0, 4},
		{0, 3},
		{2},
		{1},
	}

	for i, row := range shape {
		got := row.toStartOffsets()
		want := wantPerRow[i]
		if diff := cmp.Diff(want, got); diff != "" {
			t.Errorf("unexpected start offsets (-want +got)\n%s", diff)
		}
	}
}