import { WORD_LENGTH, SrordleBoard, LetterAnswer, SrordleAnswer, Shape } from './lib/board'
import SrordleKeyboard from './lib/keyboard'
import './style.css'

interface AddGuessResponse {
  Answer?: LetterAnswer[]
  Won?: boolean
  Error?: string
}

interface SrordleGame {
  Shape: Shape
  FullAttempts: number
}

interface SrordleResponse {
  Game?: SrordleGame
  Error?: string
}

const ready = (fn: () => void): void => {
  if (document.readyState != 'loading'){
    fn()
  } else {
    document.addEventListener('DOMContentLoaded', fn)
  }
}

const getElement = (id: string): HTMLElement => {
  const el = document.getElementById(id)
  if (!el) {
    throw new Error(`#${id} not found`)
  }
  return el
}

const getAndResizeCanvas = (id: string): HTMLCanvasElement => {
  const el = getElement(id)
  if (!(el instanceof HTMLCanvasElement)) {
    throw new Error(`#${id} was not a canvas element`)
  }

  if (el.parentNode) {
    const rect = (el.parentNode as Element).getBoundingClientRect()
    el.width = rect.width
    el.height = rect.height
  }

  return el
}

const queryEl = (el: HTMLElement, query: string): Element => {
  const subEl = el.querySelector(query)
  if (!subEl) {
    throw new Error(`couldnt find sub element from query ${query}`)
  }
  return subEl
}

interface ShowMessageOptions {
  timeout?: number
  class?: string
}

const showMessage = (headerMsg: string, msg: string, opts?: ShowMessageOptions) => {
  if (!opts) {
    opts = {}
  }
  const container = getElement('message-card-container')
  const card = getElement('message-card')
  const header = queryEl(card, 'header h1')
  const body = queryEl(card, 'p')
  header.textContent = headerMsg
  body.textContent = msg
  card.classList.remove('error-message')
  card.classList.remove('success-message')
  if (opts.class) { card.classList.add(opts.class) }
  container.classList.remove('is-hidden')
  if (opts.timeout) {
    setTimeout(() => { container.classList.add('is-hidden') }, opts.timeout)
  }
}

const showError = (msg: string) => {
  showMessage('Error', msg, { class: 'error-message', timeout: 1250 })
}

const showWin = () => {
  showMessage('You\'ve won!', 'Congratulations!', { class: 'success-message' })
}

const showLose = (targetWord?: string) => {
  const opts: ShowMessageOptions = { class: 'error-message' }
  if (targetWord) {
    showMessage(`You've lost, the word was ${targetWord.toUpperCase()}`, 'Womp womp. If this isn\'t your last legit run, refresh the page to play again.', opts)
  } else {
    showMessage('You\'ve lost.', 'Womp womp.', opts)
  }
}

class Game {
  private board: SrordleBoard
  private kb: SrordleKeyboard
  private gd: GameDate
  private currentGuess: string[] = []
  private shape?: Shape
  private pastGuesses: SrordleAnswer[] = []
  private currentRequestedFull = false
  private remainingFullAttempts = 0
  private totalFullAttempts = 0
  private gameOver = false
  private submitGuessCallback?: (answers: SrordleAnswer[]) => void | undefined
  private requestCountChangeCallback?: (n: number) => void | undefined

  constructor(board: SrordleBoard, kb: SrordleKeyboard, gd: GameDate) {
    this.board = board
    this.kb = kb
    this.gd = gd
  }

  public start(shape: Shape, pastGuesses: SrordleAnswer[], remainingFullAttempts: number, totalFullAttempts: number): void {
    this.kb.onDeleteLetter(() => this.deleteLetter())
    this.kb.onSubmitGuess(() => this.submitGuess())
    this.kb.onAddLetter((l: string) => this.addLetter(l))

    this.shape = shape
    this.remainingFullAttempts = remainingFullAttempts
    this.totalFullAttempts = totalFullAttempts
    this.pastGuesses = [...pastGuesses]
    this.board.setGameShape(shape)
    this.board.setPastGuesses([...pastGuesses])
    this.kb.setPastGuesses([...pastGuesses])
    if (this.requestCountChangeCallback) {
      this.requestCountChangeCallback(this.remainingFullAttempts)
    }
  }

  public onSubmitGuess(callback: (answers: SrordleAnswer[]) => void): void {
    this.submitGuessCallback = callback
  }

  public onRequestCountChanged(callback: (n: number) => void): void {
    this.requestCountChangeCallback = callback
  }

  public isAttemptingFullRequest(): boolean {
    return this.currentRequestedFull
  }

  public handleRequestedFull() {
    // Clear out their initial guess, as it might not fit well anymore.
    this.currentGuess = []
    this.board.updateCurrentGuess(this.currentGuess)

    this.currentRequestedFull = !this.currentRequestedFull
    if (this.currentRequestedFull) {
      this.remainingFullAttempts--
    } else {
      this.remainingFullAttempts++
    }
    if (this.requestCountChangeCallback) {
      this.requestCountChangeCallback(this.remainingFullAttempts)
    }
    this.board.setRequestedFull(this.currentRequestedFull)
  }

  public handleKeydown(e: KeyboardEvent) {
    e.stopPropagation()

    if (e.key === 'Backspace') {
      this.deleteLetter()
      return
    }

    // Enter
    if (e.key === 'Enter') {
      this.submitGuess()
      return
    }

    // A letter character.
    if (e.key >= 'a' && e.key <= 'z') {
      this.addLetter(e.key)
    }
  }

  public currentRowLength(): number {
    if (!this.shape) {
      throw new Error('no shape was set')
    }
    let curShape = 0
    for (const pg of this.pastGuesses) {
      // We don't skip the shape if they requested full, we just go to it after.
      if (pg.RequestedFull) {
        continue
      }
      curShape++
    }
    if (curShape >= this.shape.length || this.currentRequestedFull) {
      return WORD_LENGTH
    }

    let cnt = 0
    this.shape[curShape].forEach((v) => { if (v) { cnt++ } })
    return cnt
  }

  private addLetter(letter: string): void {
    if (this.currentGuess.length >= this.currentRowLength() || this.gameOver) {
      return
    }
    this.currentGuess.push(letter)
    this.board.updateCurrentGuess(this.currentGuess)
  }

  private deleteLetter(): void {
    if (this.gameOver) {
      return
    }
    this.currentGuess.pop()
    this.board.updateCurrentGuess(this.currentGuess)
  }

  private nonRequestedFullCount(): number {
    let cnt = 0
    for (const pg of this.pastGuesses) {
      if (pg.RequestedFull) {
        continue
      }
      cnt++
    }
    return cnt
  }
  
  private submitGuess(): void {
    if (this.gameOver) {
      return
    }
    const useFull = this.currentRequestedFull
    const guessIndex = this.nonRequestedFullCount()
    const req = {
      guess: this.currentGuess.join(''),
      tzOffset: this.gd.getTZOffset(),
      useFull,
      guessIndex,
    }

    fetch('/api/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', },
      body: JSON.stringify(req),
    })
      .then((response) => response.json())
      .then((data: AddGuessResponse) => {
        if (data.Error) {
          showError(data.Error)
          return
        }
        if (data.Answer) {
          const sa: SrordleAnswer = {
            LetterAnswers: data.Answer,
            RequestedFull: useFull,
          }
          this.board.addGuess(sa)
          this.kb.addGuess(sa)
          this.pastGuesses.push(sa)
          if (this.submitGuessCallback) {
            this.submitGuessCallback(this.pastGuesses)
          }
        }

        this.currentRequestedFull = false
        this.currentGuess = []
        this.board.updateCurrentGuess([])
        if (useFull || (this.shape && guessIndex >= this.shape.length)) {
          if (this.requestCountChangeCallback) {
            this.requestCountChangeCallback(this.remainingFullAttempts)
          }
        }

        if (data.Won) {
          this.gameOver = true
          showWin()
          return
        }
        if ((this.shape && this.pastGuesses.length >= (this.shape.length + this.totalFullAttempts)) || this.remainingFullAttempts === 0) {
          this.gameOver = true
          showLose('')
          return
        }
      })
  }
}

class GameDate {
  private str: string
  private tzOffset: number

  constructor(d: Date) {
    this.str = `${d.getFullYear()}-${d.getMonth() + 1}-${d.getDate()}`
    this.tzOffset = d.getTimezoneOffset() * 60
  }

  public asKey(prefix: string): string {
    return `${prefix}:${this.str}`
  }

  public getTZOffset(): number {
    return this.tzOffset
  }
}

const loadPastGuesses = (gd: GameDate): SrordleAnswer[] => {
  const str = window.localStorage.getItem(gd.asKey('pastGuesses'))
  if (!str) {
    return []
  }
  return JSON.parse(str)
}

const loadRemainingFullAttempts = (gd: GameDate, defaultForGame: number): number => {
  const str = window.localStorage.getItem(gd.asKey('remainingFullAttempts'))
  if (!str) {
    return defaultForGame
  }
  return JSON.parse(str)
}

const saveRemainingFullAttempts = (gd: GameDate, remainingAttempts: number): void => {
  window.localStorage.setItem(gd.asKey('remainingFullAttempts'), JSON.stringify(remainingAttempts))
}

const savePastGuesses = (gd: GameDate, guesses: SrordleAnswer[]): void => {
  window.localStorage.setItem(gd.asKey('pastGuesses'), JSON.stringify(guesses))
}

interface FetchData {
  sr: SrordleResponse
  gd: GameDate
}

const fetchSrordle = (gd: GameDate): Promise<FetchData> => {
  const req = { tzOffset: gd.getTZOffset() }
  return fetch('/api/srordle', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', },
    body: JSON.stringify(req),
  })
    .then((response) => response.json())
    .then((data: SrordleResponse) => ({ sr: data, gd }))
}

const initGame = (fd: FetchData) => {
  const { sr, gd } = fd
  if (sr.Error) {
    showError(sr.Error)
    return
  }
  if (!sr.Game) {
    showError('No game was returned')
    return
  }
  const pastGuesses = loadPastGuesses(gd)

  const board = getAndResizeCanvas('board')
  const keyboard = getAndResizeCanvas('keyboard')
  const reqBtn = getElement('request-full')
  if (!(reqBtn instanceof HTMLButtonElement)) {
    throw new Error('#request-full was wrong type')
  }
  const reqText = getElement('request-text')

  if (pastGuesses.length > 0) {
    reqBtn.classList.remove('is-hidden')
    reqText.classList.remove('is-hidden')
  }

  const tb = new SrordleBoard(board)
  const kb = new SrordleKeyboard(keyboard)
  const game = new Game(tb, kb, gd)
  game.onSubmitGuess((answers: SrordleAnswer[]) => {
    reqBtn.classList.remove('is-hidden')
    reqText.classList.remove('is-hidden')
    reqBtn.disabled = game.currentRowLength() === WORD_LENGTH
    savePastGuesses(gd, answers)
  })
  game.onRequestCountChanged((reqCount: number) => {
    reqBtn.textContent = game.isAttemptingFullRequest() ? 'Unattempt 7-Letter Guess' : 'Attempt 7-Letter Guess'
    switch (reqCount) {
    case 2:
      reqText.textContent = 'Two remaining'
      break
    case 1:
      reqText.textContent = 'One remaining'
      break
    case 0:
      reqText.textContent = ''
      reqBtn.textContent = 'No attempts remaining'
      break
    }
    reqBtn.disabled = reqCount <= 0
    saveRemainingFullAttempts(gd, reqCount)
  })

  game.start(sr.Game.Shape, pastGuesses, loadRemainingFullAttempts(gd, sr.Game.FullAttempts), sr.Game.FullAttempts)
  if (game.currentRowLength() === WORD_LENGTH) {
    reqBtn.disabled = true
  }

  document.addEventListener('keydown', (e) => game.handleKeydown(e))
  reqBtn.addEventListener('click', (_e) => {
    reqBtn.blur()
    game.handleRequestedFull()
  })
}

ready(() => {
  const today = new GameDate(new Date())
  fetchSrordle(today).then(initGame)
})
