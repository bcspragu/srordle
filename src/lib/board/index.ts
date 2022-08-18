import * as paper from 'paper/dist/paper-core'
import { Colors } from '../color'

export enum LetterStatus {
  NotInWord = 1,
  WrongPosition,
  Correct,
  PositionNotUsed,
  // The server will never send these, we use it for rendering.
  Guessing,
  Untried,
}

export interface LetterAnswer {
  Letter: string;
  Status: LetterStatus;
}

export interface SrordleAnswer {
  LetterAnswers: LetterAnswer[]
  RequestedFull: boolean
}

type Row = boolean[]

export type Shape = Row[]

interface Char {
  cap: paper.Path.RegularPolygon;
  letter: paper.PointText;
}

export const WORD_LENGTH = 7

export class SrordleBoard {
  private shape: Shape = []
  private pastGuesses: SrordleAnswer[] = []
  private currentGuess: string[] = []
  private currentRequestedFull = false

  private chars: Char[][] = []
  private fullRows: paper.Path.RegularPolygon[] = []

  private scope: paper.PaperScope

  constructor(board: HTMLCanvasElement) {
    this.scope = new paper.PaperScope()
    this.scope.setup(board)

    this.initPaper()
  }

  public addGuess(guess: SrordleAnswer) {
    this.currentRequestedFull = false
    this.pastGuesses.push(guess)
    this.render()
  }

  public setRequestedFull(v: boolean) {
    this.currentRequestedFull = v
    this.render()
  }

  public setGameShape(shape: Shape) {
    this.shape = shape
  }

  public setPastGuesses(guesses: SrordleAnswer[]) {
    this.pastGuesses = guesses
    this.render()
  }

  public updateCurrentGuess(guess: string[]) {
    this.currentGuess = guess
    this.render()
  }

  private render(): void {
    if (!this.scope || this.chars.length === 0) {
      return
    }

    const correctGuess = this.correctGuess()
    let i = -1
    for (const _row of this.chars) {
      i++
      this.fullRows[i].style.fillColor = null

      // If we have a past guess, put that down.
      if (this.pastGuesses.length > i && (!correctGuess || correctGuess >= i)) {
        for (let j = 0; j < this.pastGuesses[i].LetterAnswers.length; j++) {
          this.setLetter(i, j, this.pastGuesses[i].LetterAnswers[j])
        }
        continue
      }

      let curShape = 0
      for (const pg of this.pastGuesses) {
        if (pg.RequestedFull) {
          continue
        }
        curShape++
      }

      const row = curShape < this.shape.length && !this.currentRequestedFull ?
        this.shape[curShape] :
        [true, true, true, true, true, true, true]


      // If we're the current guess, show it.
      if (i === this.pastGuesses.length && !correctGuess) {
        let x = 0
        let letterIdx = 0
        for (const v of row) {
          if (v && letterIdx < this.currentGuess.length) {
            this.setLetter(i, x, { Letter: this.currentGuess[letterIdx], Status: LetterStatus.Guessing })
            letterIdx++
          } else if (!v) {
            this.setLetter(i, x, { Letter: '', Status: LetterStatus.PositionNotUsed })
          } else {
            this.setLetter(i, x, { Letter: '', Status: LetterStatus.Guessing })
          }
          x++
        }
        continue
      }

      // If we're a future row and not the current one, full bar across.
      if (i !== this.pastGuesses.length) {
        this.fullRows[i].style.fillColor = Colors.blankRowBG
        continue
      }
    }
  }

  private setLetter(i: number, j: number, la: LetterAnswer) {
    const char = this.chars[i][j]
    char.letter.content = la.Letter.toUpperCase()
    switch (la.Status) {
    case LetterStatus.NotInWord:
      char.letter.style.fillColor = Colors.white
      char.cap.style.fillColor = Colors.greyBG
      break
    case LetterStatus.WrongPosition:
      char.letter.style.fillColor = Colors.black
      char.cap.style.fillColor = Colors.yellow
      break
    case LetterStatus.Correct:
      char.letter.style.fillColor = Colors.black
      char.cap.style.fillColor = Colors.green
      break
    case LetterStatus.Guessing:
      char.letter.style.fillColor = Colors.white
      char.cap.style.fillColor = Colors.grey
      break
    case LetterStatus.PositionNotUsed:
      char.letter.style.fillColor = Colors.white // Doesn't really matter, there's no letter.
      char.cap.style.fillColor = Colors.black
    }
  }

  private correctGuess(): number | null {
    let i = 0
    for (const guess of this.pastGuesses) {
      if (guess.LetterAnswers.every((l) => l.Status === LetterStatus.Correct)) {
        return i
      }
      i++
    }
    return null
  }

  private initPaper(): void {
    if (!this.scope) {
      console.log('project has not been initialized')
      return
    }

    const bounds = this.scope.view.bounds
    const buf = 0.1
    const widthChars = 7
    const heightChars = 8

    let keySz = bounds.height / (heightChars * (1 + buf))
    keySz = Math.min(keySz, bounds.width / (widthChars * (1 + buf)))
    const margin = keySz * buf

    const fontSize = 16 * (keySz / 20)
    let fontWeight = '500'
    const centerBias = 3.9
    if (keySz < 25) {
      fontWeight = '600'
    }

    const xOffset = (bounds.width - (widthChars * (margin + keySz))) / 2
    const yOffset = (bounds.height - (heightChars * (margin + keySz))) / 2

    for (let i = 0; i < heightChars; i++) {
      this.fullRows.push(new this.scope.Path.Rectangle({
        point: new this.scope.Point(xOffset, yOffset + i * (keySz + margin)),
        size: new this.scope.Size((keySz + margin) * widthChars - margin, keySz),
        radius: 5,
      }))
    }

    let x = 0
    let y = 0
    for (let i = 0; i < heightChars; i++) {
      this.chars.push([])
      for (let j = 0; j < widthChars; j++) {
        const rect = new this.scope.Rectangle(
          new this.scope.Point(x + xOffset, y + yOffset),
          new this.scope.Size(keySz, keySz),
        )
        this.chars[this.chars.length - 1].push({
          cap: new this.scope.Path.Rectangle({
            point: rect.point,
            size: rect.size,
            radius: 5,
          }),
          letter: new this.scope.PointText({
            content: '',
            point: rect.center.add(new this.scope.Point(0, keySz / centerBias)),
            justification: 'center',
            fontSize,
            fontWeight,
            fillColor: Colors.black,
          }),
        })
        x += keySz + margin
      }
      x = 0
      y += keySz + margin
    }
  }
}
