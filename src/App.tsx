// src/App.tsx
import { useEffect, useRef } from 'react'
import { GameLoop } from './engine/GameLoop'
import { SceneManager } from './engine/SceneManager'
import { InputManager } from './engine/InputManager'
import { Renderer } from './engine/Renderer'
import { LocalStorage } from './engine/Storage'
import { SaveDataService } from './game/SaveDataService'
import { MenuScene } from './scenes/MenuScene'
import { BattleScene } from './scenes/BattleScene'
import { SettlementScene } from './scenes/SettlementScene'
import { StageSelectScene } from './scenes/StageSelectScene'
import { STAGES, DIFFICULTIES, DIFFICULTY_ORDER } from './config'

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const renderer = new Renderer()
    renderer.attach(canvas)

    const sceneManager = new SceneManager()
    const inputManager = new InputManager()
    const gameLoop = new GameLoop()
    const storage = new LocalStorage()
    const saveService = new SaveDataService(storage)

    const switchTo = (name: string) => sceneManager.switchTo(name)

    // --- Scenes ---
    const menuScene = new MenuScene(switchTo)
    const battleScene = new BattleScene(switchTo)
    const settlementScene = new SettlementScene(switchTo)
    const stageSelectScene = new StageSelectScene(switchTo)

    sceneManager.register(menuScene)
    sceneManager.register(battleScene)
    sceneManager.register(settlementScene)
    sceneManager.register(stageSelectScene)

    // --- Refresh menu data ---
    const refreshMenu = () => {
      menuScene.setData(STAGES, saveService.load(), DIFFICULTIES, DIFFICULTY_ORDER)
    }

    // --- MenuScene actions ---
    menuScene.setActionHandler((action) => {
      if (action === 'continue') {
        const save = saveService.load()
        battleScene.setLevel(save.currentStageIndex, save.currentLevelIndex)
        switchTo('battle')
      } else if (action === 'select') {
        stageSelectScene.setData(STAGES, saveService.load())
        switchTo('stageSelect')
      } else if (action === 'difficulty') {
        const save = saveService.load()
        const currentIdx = DIFFICULTY_ORDER.indexOf(save.difficulty)
        const nextIdx = (currentIdx + 1) % DIFFICULTY_ORDER.length
        saveService.setDifficulty(DIFFICULTY_ORDER[nextIdx])
        refreshMenu()
      }
    })

    // --- BattleScene end handler ---
    battleScene.setBattleEndHandler((params) => {
      settlementScene.setParams(params)
      switchTo('settlement')
    })

    // --- SettlementScene actions ---
    settlementScene.setActionHandler((action, stageIndex, levelIndex) => {
      if (action === 'continue') {
        // Write save, advance to next level
        const stage = STAGES[stageIndex]
        const stars = settlementScene.getParams()?.stars ?? 1
        const hasNextStage = stageIndex + 1 < STAGES.length
        saveService.completeLevel(stageIndex, levelIndex, stars, stage.levels.length, hasNextStage)

        const save = saveService.load()
        if (saveService.isAllCompleted()) {
          refreshMenu()
          switchTo('menu')
        } else {
          battleScene.setLevel(save.currentStageIndex, save.currentLevelIndex)
          switchTo('battle')
        }
      } else if (action === 'replay') {
        battleScene.setLevel(stageIndex, levelIndex)
        switchTo('battle')
      } else if (action === 'select') {
        stageSelectScene.setData(STAGES, saveService.load())
        switchTo('stageSelect')
      }
    })

    // --- StageSelectScene actions ---
    stageSelectScene.setActionHandler((action, stageIndex, levelIndex) => {
      if (action === 'play') {
        battleScene.setLevel(stageIndex, levelIndex)
        switchTo('battle')
      } else if (action === 'back') {
        refreshMenu()
        switchTo('menu')
      }
    })

    // --- Input ---
    inputManager.addListener((event) => sceneManager.handleInput(event))
    inputManager.attach(window)

    // --- Resize ---
    const handleResize = () => {
      renderer.resize(window.innerWidth, window.innerHeight)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

    // --- Start ---
    refreshMenu()
    sceneManager.switchTo('menu')
    const ctx = renderer.getContext()!
    gameLoop.start(sceneManager, ctx)

    return () => {
      gameLoop.stop()
      inputManager.detach(window)
      window.removeEventListener('resize', handleResize)
    }
  }, [])

  return (
    <div id="game-root">
      <canvas
        ref={canvasRef}
        style={{ display: 'block', width: '100%', height: '100%' }}
      />
    </div>
  )
}
