import { useCallback, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useDispatch, useStore } from 'react-redux'
import './App.css'
import { Sidebar, ViewMode } from './components/layout/Sidebar'
import { CampaignManagerView } from './components/campaign/CampaignManagerView'
import { InitiativeView } from './components/initiative/InitiativeView'
import {
  loadState as loadCombatStateAction,
  type LoadCombatStateArgs,
} from './store/combatSlice'
import {
  loadState as loadCampaignStateAction,
  type LoadCampaignStateArgs,
} from './store/campaignSlice'
import {
  loadState as loadMonsterLibraryStateAction,
  type LoadMonsterLibraryArgs,
} from './store/monsterLibrarySlice'
import type { AppDispatch, AppStore } from './store'

/**
 * Renders the root application layout and orchestrates data import/export actions.
 */
function App() {
  const dispatch = useDispatch<AppDispatch>()
  const store = useStore<AppStore>()
  const [activeView, setActiveView] = useState<ViewMode>('initiative')
  const [loadError, setLoadError] = useState('')
  const [resetKey, setResetKey] = useState<number>(0)
  const fileInputRef = useRef<HTMLInputElement>(null)

  /**
   * Switches between the initiative tracker and campaign manager views.
   */
  const handleViewChange = useCallback((view: ViewMode) => {
    setActiveView(view)
  }, [])

  /**
   * Creates a downloadable JSON snapshot of the current Redux state.
   */
  const handleDownloadState = useCallback(() => {
    const state = store.getState()
    const payload = {
      combat: state.combat,
      campaigns: state.campaigns,
      monsterLibrary: state.monsterLibrary,
      exportedAt: Date.now(),
    }

    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = 'dnd-initiative-tracker-data.json'
    anchor.click()
    URL.revokeObjectURL(url)
  }, [store])

  /**
   * Focuses the hidden file input so the user can select a saved state file.
   */
  const handleUploadClick = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  /**
   * Applies loaded state to Redux after validating the uploaded file.
   */
  const handleFileInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0]
      if (!file) {
        return
      }

      const reader = new FileReader()

      reader.onload = (loadEvent) => {
        try {
          const text = String(loadEvent.target?.result ?? '')
          const parsed = JSON.parse(text) as {
            combat?: LoadCombatStateArgs
            campaigns?: LoadCampaignStateArgs
            monsterLibrary?: LoadMonsterLibraryArgs
          }

          let hasValidData = false

          if (parsed.combat && typeof parsed.combat === 'object') {
            dispatch(loadCombatStateAction(parsed.combat))
            hasValidData = true
          }

          if (parsed.campaigns && typeof parsed.campaigns === 'object') {
            dispatch(loadCampaignStateAction(parsed.campaigns))
            hasValidData = true
          } else if (
            parsed.combat &&
            typeof parsed.combat === 'object' &&
            Array.isArray((parsed.combat as LoadCombatStateArgs).playerTemplates)
          ) {
            const legacyCampaignPayload: LoadCampaignStateArgs = {
              campaigns:
                (parsed.combat as LoadCombatStateArgs).playerTemplates?.length ?? 0 > 0
                  ? [
                      {
                        id: 'legacy-import',
                        name: 'Imported roster',
                        notes: '',
                        createdAt: Date.now(),
                        playerCharacters: (parsed.combat as LoadCombatStateArgs).playerTemplates ?? [],
                      },
                    ]
                  : [],
              activeCampaignId:
                (parsed.combat as LoadCombatStateArgs).playerTemplates?.length ?? 0 > 0
                  ? 'legacy-import'
                  : null,
            }
            dispatch(loadCampaignStateAction(legacyCampaignPayload))
            hasValidData = true
          }

          if (parsed.monsterLibrary && typeof parsed.monsterLibrary === 'object') {
            dispatch(loadMonsterLibraryStateAction(parsed.monsterLibrary))
            hasValidData = true
          }

          if (hasValidData) {
            setLoadError('')
            setResetKey(Date.now())
          } else {
            setLoadError('The selected file does not contain recognizable assistant data.')
          }
        } catch (error) {
          console.error('Failed to parse uploaded state file', error)
          setLoadError('Failed to load file. Please select a valid DNDdata file.')
        }

        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }

      reader.onerror = () => {
        setLoadError('Failed to read the selected file.')
        if (fileInputRef.current) {
          fileInputRef.current.value = ''
        }
      }

      reader.readAsText(file)
    },
    [dispatch],
  )

  /**
   * Memoizes the initiative view element with the current reset key.
   */
  const initiativeView = useMemo(
    () => <InitiativeView onNavigateToCampaigns={() => handleViewChange('campaigns')} resetKey={resetKey} />,
    [handleViewChange, resetKey],
  )

  /**
   * Memoizes the campaign manager view to avoid unnecessary re-renders.
   */
  const campaignView = useMemo(() => <CampaignManagerView />, [])

  return (
    <div className="app-shell">
      <Sidebar
        activeView={activeView}
        onViewChange={handleViewChange}
        onDownloadState={handleDownloadState}
        onUploadClick={handleUploadClick}
        loadError={loadError}
        fileInputRef={fileInputRef}
        onFileChange={handleFileInputChange}
      />
      <main className="main">
        {activeView === 'campaigns' ? campaignView : initiativeView}
      </main>
    </div>
  )
}

export default App
