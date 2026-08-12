import { useState } from 'react'

import App from './App'
import SplashScreen from './components/SplashScreen'

type Stage = 'splash' | 'app'

export default function Root() {
  const [stage, setStage] = useState<Stage>('splash')

  return (
    <div className="h-full">
      {stage === 'splash' && <SplashScreen onDone={() => setStage('app')} />}
      {stage === 'app' && (
        <div className="h-full animate-[login-fade_0.8s_ease-out_both]">
          <App />
        </div>
      )}
      <style>{`
        @keyframes login-fade {
          0% { opacity: 0; }
          100% { opacity: 1; }
        }
      `}</style>
    </div>
  )
}
