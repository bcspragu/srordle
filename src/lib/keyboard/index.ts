import * as paper from 'paper/dist/paper-core'
import { Colors } from '../color'
import { LetterStatus, SrordleAnswer } from '../board'

const KEYS_BY_ROW = [
  ['q', 'w', 'e', 'r', 't', 'y', 'u', 'i', 'o', 'p'],
  ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k', 'l'],
  ['z', 'x', 'c', 'v', 'b', 'n', 'm'],
]

interface Key {
  bg: paper.Path.RegularPolygon;
  letter: paper.PointText;
}

export default class SrordleKeyboard {

  private scope: paper.PaperScope
  private submitGuessCallback?: () => void | undefined
  private addLetterCallback?: (l: string) => void | undefined
  private deleteLetterCallback?: () => void | undefined
  private keys: Key[] = []
  private pastGuesses: SrordleAnswer[] = []

  constructor(kb: HTMLCanvasElement) {
    this.scope = new paper.PaperScope()
    this.scope.setup(kb)

    this.initPaper()
  }

  public onSubmitGuess(callback: () => void): void {
    this.submitGuessCallback = callback
  }

  public onDeleteLetter(callback: () => void): void {
    this.deleteLetterCallback = callback
  }

  public onAddLetter(callback: (l: string) => void): void {
    this.addLetterCallback = callback
  }

  private submitGuess(): void {
    if (!this.submitGuessCallback) {
      return
    }
    this.submitGuessCallback()
  }

  public addGuess(guess: SrordleAnswer) {
    this.pastGuesses.push(guess)
    this.render()
  }

  private addLetter(letter: string): void {
    if (!this.addLetterCallback) {
      return
    }
    this.addLetterCallback(letter)
  }

  private deleteLetter(): void {
    if (!this.deleteLetterCallback) {
      return
    }
    this.deleteLetterCallback()
  }

  private initPaper(): void {
    if (!this.scope) {
      console.log('project has not been initialized')
      return
    }

    const bounds = this.scope.view.bounds
    const buf = 0.1

    let keySz = bounds.height / (KEYS_BY_ROW.length * (1 + buf))
    keySz = Math.min(keySz, bounds.width / (KEYS_BY_ROW[0].length * (1 + buf)))
    const margin = keySz * buf

    let x = 0
    let y = 0
    let rowIdx = 0
    for (const row of KEYS_BY_ROW) {
      const rowOffset = (bounds.width - (row.length * (keySz + margin))) / 2
      if (rowIdx === 2) {
        const firstRowOffset  = (bounds.width - (KEYS_BY_ROW[0].length * (keySz + margin))) / 2
        const firstRowEndPos = firstRowOffset + (KEYS_BY_ROW[0].length * (keySz + margin))
        const keyRect = new this.scope.Rectangle(
          new this.scope.Point(firstRowOffset, y),
          new this.scope.Size(firstRowEndPos - firstRowOffset, keySz),
        )
        this.placeButtons(keyRect, keySz, rowOffset - margin, rowOffset + (row.length * (keySz + margin)), y)
      }

      for (const letter of row) {
        const rect = new this.scope.Rectangle(
          new this.scope.Point(x + rowOffset, y),
          new this.scope.Size(keySz, keySz),
        )
        const bg = new this.scope.Path.Rectangle({
          point: rect.point,
          size: rect.size,
          radius: 5,
        })

        const onClick = () => {
          // TODO: Make this work. Looks like it doesn't because something is
          // assuming we're in a PaperScript environment when we aren't.
          // bg.tweenFrom({fillColor: Colors.black}, 150)
          this.addLetter(letter)
        }
        const letterText = new this.scope.PointText({
          content: letter.toUpperCase(),
          point: rect.center.add(new this.scope.Point(0, keySz / 5.2)),
          justification: 'center',
          fontSize: 16 * (keySz / 30),
          fontWeight: '600',
          fillColor: Colors.black,
        })
        bg.onClick = onClick
        letterText.onClick = onClick
        this.keys.push({
          bg: bg,
          letter: letterText,
        })
        x += keySz + margin
      }
      x = 0
      y += keySz + margin
      rowIdx++
    }
  }

  private placeButtons(bounds: paper.Rectangle, keySz: number, x1: number, x2: number, y: number) {
    if (!this || !this.scope) {
      return
    }

    this.createSVG('/images/backspace.svg', new this.scope.Rectangle(
      new this.scope.Point(bounds.left, y),
      new this.scope.Size(x1 - bounds.left, keySz),
    ), () => this.deleteLetter())
    this.createSVG('/images/enter.svg', new this.scope.Rectangle(
      new this.scope.Point(x2, y),
      new this.scope.Size(bounds.right - x2, keySz),
    ), () => this.submitGuess())
  }

  private createSVG(url: string, rect: paper.Rectangle, action: () => void) {
    if (!this.scope) {
      return
    }

    this.scope.project.importSVG(url, {
      expandShapes: true,
      onLoad: (img: paper.Item) => {
        const bg = new this.scope.Path.Rectangle({
          point: rect.point,
          size: rect.size,
          radius: 5,
          applyMatrix: false,
        })
        bg.style.fillColor = Colors.notTriedBG
        bg.sendToBack()
        const onClick = () => {
          // TODO: Make this work. Looks like it doesn't because something is
          // assuming we're in a PaperScript environment when we aren't.
          // bg.tween(
          //   {scaling: 0.75},
          //   {scaling: 1},
          //   {duration: 150, easing: 'easeInOutCubic'},
          // )
          action()
        }
        bg.onClick = onClick
        img.onClick = onClick
        img.scale(0.45 * rect.width / img.bounds.width)
        img.position = rect.center.add(new this.scope.Point(-2, 0))
      },
    })
  }

  public setPastGuesses(guesses: SrordleAnswer[]) {
    this.pastGuesses = guesses
    this.render()
  }

  private sumGuessKnowledge(): Map<string, LetterStatus> {
    const tmp = new Map<string, LetterStatus[]>()
    for (const guess of this.pastGuesses) {
      for (const la of guess.LetterAnswers) {
        if (la.Letter === '' || la.Status === LetterStatus.PositionNotUsed) {
          continue
        }
        const ls = tmp.get(la.Letter) ?? []
        ls.push(la.Status)
        tmp.set(la.Letter, ls)
      }
    }

    const sum = new Map<string, LetterStatus>()
    for (const row of KEYS_BY_ROW) {
      for (const key of row) {
        const ls = tmp.get(key)
        if (!ls) {
          sum.set(key, LetterStatus.Untried)
          continue
        }

        // If any of them was correct, that's what we should show.
        // TODO: Maybe handle the case when there are two or more of the same
        // letter in a row.
        if (ls.some((l) => l === LetterStatus.Correct)) {
          sum.set(key, LetterStatus.Correct)
          continue
        }

        // Otherwise, if something was in the wrong position, note that.
        if (ls.some((l) => l === LetterStatus.WrongPosition)) {
          sum.set(key, LetterStatus.WrongPosition)
          continue
        }

        if (ls.some((l) => l === LetterStatus.NotInWord)) {
          sum.set(key, LetterStatus.NotInWord)
          continue
        }

        throw new Error(`exhausted all cases for letter status: ${ls}`)
      }
    }

    return sum
  }

  private render(): void {
    const sum = this.sumGuessKnowledge()
    for (const key of this.keys) {
      const ls = sum.get(key.letter.content.toLowerCase())
      if (!ls) {
        continue
      }

      switch (ls) {
      case LetterStatus.Untried:
        key.bg.style.fillColor = Colors.notTriedBG
        key.letter.style.fillColor = Colors.notTriedText
        break
      case LetterStatus.NotInWord:
        key.bg.style.fillColor = Colors.notPresentBG
        key.letter.style.fillColor = Colors.notPresentText
        break
      case LetterStatus.WrongPosition:
        key.bg.style.fillColor = Colors.yellow
        key.letter.style.fillColor = Colors.black
        break
      case LetterStatus.Correct:
        key.bg.style.fillColor = Colors.green
        key.letter.style.fillColor = Colors.black
        break
      }
    }
  }
}
