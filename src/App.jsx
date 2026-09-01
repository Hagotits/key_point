import { useState } from 'react'
import ProjectSetup from './components/ProjectSetup'
import LabelSetup from './components/LabelSetup'
import Labeler from './components/Labeler'
import { restoreImageAssets } from './utils'

// step: 'project' → 'setup' → 'label'
export default function App() {
  const [step, setStep] = useState('project')
  const [projectName, setProjectName] = useState('')
  const [keypointDefs, setKeypointDefs] = useState([])
  const [edges, setEdges] = useState([])
  const [images, setImages] = useState([])

  const screen = typeof step === 'string' ? step : step.screen
  const initialSession = typeof step === 'object' ? step.initialSession : undefined

  const handleProjectCreate = (name) => {
    setProjectName(name)
    setStep('setup')
  }

  const handleSetupDone = (defs, edgeList, imgs) => {
    setKeypointDefs(defs)
    setEdges(edgeList)
    setImages(imgs)
    setStep('label')
  }

  const handleResume = (stored) => {
    setProjectName(stored.projectName || '')
    setKeypointDefs(stored.keypointDefs)
    setEdges(stored.edges)
    setImages(restoreImageAssets(stored.images))
    setStep({ screen: 'label', initialSession: stored })
  }

  return (
    <div className="app">
      {screen === 'project' && (
        <ProjectSetup onCreate={handleProjectCreate} onResume={handleResume} />
      )}
      {screen === 'setup' && (
        <LabelSetup projectName={projectName} onDone={handleSetupDone} />
      )}
      {screen === 'label' && (
        <Labeler
          projectName={projectName}
          keypointDefs={keypointDefs}
          edges={edges}
          images={images}
          onAddImages={(imgs) => setImages((prev) => [...prev, ...imgs])}
          initialSession={initialSession}
        />
      )}
    </div>
  )
}
