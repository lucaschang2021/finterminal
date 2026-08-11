import { useState } from 'react'

import { autoLoginUser } from '@/lib/auth'
import App from './App'
import LoginPage from './components/LoginPage'
import SplashScreen from './components/SplashScreen'

type Stage = 'splash' | 'login' | 'app'

export default function Root() {
  const [stage, setStage] = useState<Stage>('splash')

  const handleSplashDone = () => {
    setStage(autoLoginUser() ? 'app' : 'login')
  }

  return (
    <div className="h-full">
      {stage === 'splash' && <SplashScreen onDone={handleSplashDone} />}
      {stage === 'login' && (
        <div className="h-full animate-[login-fade_0.8s_ease-out_both]">
          <LoginPage onSuccess={() => setStage('app')} />
        </div>
      )}
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
