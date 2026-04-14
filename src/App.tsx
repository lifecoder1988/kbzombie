// src/App.tsx
import { useEffect, useRef } from 'react'
import { GameLoop } from './engine/GameLoop'
import { SceneManager } from './engine/SceneManager'
import { InputManager } from './engine/InputManager'
import { Renderer } from './engine/Renderer'
import { MenuScene } from './scenes/MenuScene'
import { BattleScene } from './scenes/BattleScene'

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

    const switchTo = (name: string) => sceneManager.switchTo(name)
    sceneManager.register(new MenuScene(switchTo))
    sceneManager.register(new BattleScene(switchTo))

    inputManager.addListener((event) => sceneManager.handleInput(event))
    inputManager.attach(window)

    const handleResize = () => {
      renderer.resize(window.innerWidth, window.innerHeight)
    }
    handleResize()
    window.addEventListener('resize', handleResize)

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
