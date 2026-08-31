import { useState } from 'react'
import ProjectSetup from './components/ProjectSetup'
import LabelSetup from './components/LabelSetup'
import Labeler from './components/Labeler'

// step: 'project' → 'setup' → 'label'
export default function App() {
  const [step, setStep] = useState('project')
  const [projectName, setProjectName] = useState('')
  const [keypointDefs, setKeypointDefs] = useState([])
  const [edges, setEdges] = useState([])
  const [images, setImages] = useState([])

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

  return (
    <div className="app">
      {step === 'project' && <ProjectSetup onCreate={handleProjectCreate} />}
      {step === 'setup' && (
        <LabelSetup projectName={projectName} onDone={handleSetupDone} />
      )}
      {step === 'label' && (
        <Labeler
          projectName={projectName}
          keypointDefs={keypointDefs}
          edges={edges}
          images={images}
          onAddImages={(imgs) => setImages((prev) => [...prev, ...imgs])}
        />
      )}
    </div>
  )
}
