import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent, FormEvent } from 'react'
import { useDispatch, useSelector, useStore } from 'react-redux'
import './App.css'
import { Sidebar, ViewMode } from './components/layout/Sidebar'
import { CampaignManagerView } from './components/campaign/CampaignManagerView'
import { InitiativeView } from './components/initiative/InitiativeView'
import { QuestLogView } from './components/quest/QuestLogView'
import { SessionLogsView } from './components/quest/SessionLogsView'
import { TreasureLedgerView } from './components/quest/TreasureLedgerView'
import {
  loadState as loadCombatStateAction,
  type LoadCombatStateArgs,
} from './store/combatSlice'
import {
  createCampaign as createCampaignAction,
  loadState as loadCampaignStateAction,
  setActiveCampaign as setActiveCampaignAction,
  type LoadCampaignStateArgs,
} from './store/campaignSlice'
import {
  loadState as loadMonsterLibraryStateAction,
  type LoadMonsterLibraryArgs,
} from './store/monsterLibrarySlice'
import type { AppDispatch, AppRootState } from './store'
import type { RootState } from './types'

/**
 * Renders the root application layout and orchestrates data import/export actions.
 */
function App() {
  const dispatch = useDispatch<AppDispatch>()
  const store = useStore<AppRootState>()
  const [activeView, setActiveView] = useState<ViewMode>('initiative')
  const [loadError, setLoadError] = useState('')
  const [resetKey, setResetKey] = useState<number>(0)
  const [isDirty, setIsDirty] = useState(false)
  const [isSidebarMinimized, setIsSidebarMinimized] = useState(false)
  const [isTopBarCreateOpen, setIsTopBarCreateOpen] = useState(false)
  const [topBarCampaignName, setTopBarCampaignName] = useState('')
  const [topBarCampaignError, setTopBarCampaignError] = useState('')
  const fileInputRef = useRef<HTMLInputElement | null>(null)
  const initialStateRef = useRef<string>('')

  const campaigns = useSelector((state: RootState) => state.campaigns.campaigns)
  const activeCampaignId = useSelector((state: RootState) => state.campaigns.activeCampaignId)
  const sortedCampaigns = useMemo(
    () => [...campaigns].sort((a, b) => a.createdAt - b.createdAt),
    [campaigns],
  )

  const getComparableState = useCallback(() => {
    const state = store.getState()
    return {
      combat: state.combat,
      campaigns: {
        campaigns: state.campaigns.campaigns,
      },
      monsterLibrary: state.monsterLibrary,
    }
  }, [store])

  const updateBaselineState = useCallback(() => {
    initialStateRef.current = JSON.stringify(getComparableState())
    setIsDirty(false)
  }, [getComparableState])

  useEffect(() => {
    updateBaselineState()
  }, [updateBaselineState])

  useEffect(() => {
    const unsubscribe = store.subscribe(() => {
      const snapshot = JSON.stringify(getComparableState())
      setIsDirty(snapshot !== initialStateRef.current)
    })

    return unsubscribe
  }, [getComparableState, store])

  /**
   * Switches between the initiative tracker and campaign manager views.
   */
  const handleViewChange = useCallback((view: ViewMode) => {
    setActiveView(view)
  }, [])


  const handleTopBarCampaignChange = useCallback(
    (event: ChangeEvent<HTMLSelectElement>) => {
      const selectedValue = event.target.value
      if (selectedValue === '__create__') {
        setIsTopBarCreateOpen(true)
        setTopBarCampaignName('')
        setTopBarCampaignError('')
        return
      }

      if (selectedValue) {
        dispatch(setActiveCampaignAction(selectedValue))
      }
    },
    [activeCampaignId, dispatch],
  )

  const handleTopBarCreateCampaignSubmit = useCallback(
    (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()
      const trimmedName = topBarCampaignName.trim()
      if (!trimmedName) {
        setTopBarCampaignError('Campaign name is required.')
        return
      }

      dispatch(createCampaignAction({ name: trimmedName }))
      setTopBarCampaignName('')
      setTopBarCampaignError('')
      setIsTopBarCreateOpen(false)
    },
    [dispatch, topBarCampaignName],
  )

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
    updateBaselineState()
  }, [store, updateBaselineState])

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
          let legacyPlayerTemplates: unknown[] | null = null

          if (parsed.combat && typeof parsed.combat === 'object') {
            const combatState = parsed.combat as LoadCombatStateArgs
            dispatch(loadCombatStateAction(combatState))
            hasValidData = true

            const candidateTemplates = combatState.playerTemplates
            if (Array.isArray(candidateTemplates)) {
              legacyPlayerTemplates = candidateTemplates
            }
          }

          if (parsed.campaigns && typeof parsed.campaigns === 'object') {
            dispatch(loadCampaignStateAction(parsed.campaigns))
            hasValidData = true
          } else if (legacyPlayerTemplates && legacyPlayerTemplates.length > 0) {
            const legacyCampaignPayload: LoadCampaignStateArgs = {
              campaigns: [
                {
                  id: 'legacy-import',
                  name: 'Imported roster',
                  notes: '',
                  createdAt: Date.now(),
                  playerCharacters: legacyPlayerTemplates,
                },
              ],
              activeCampaignId: 'legacy-import',
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
            updateBaselineState()
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
    [dispatch, updateBaselineState],
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
  const questLogView = useMemo(() => <QuestLogView />, [])
  const sessionLogsView = useMemo(() => <SessionLogsView />, [])
  const treasureLedgerView = useMemo(() => <TreasureLedgerView />, [])


  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="top-bar__brand">QuestKeep TTRPG</div>
        <div className="top-bar__actions">
          <label className="top-bar__campaign-select top-bar__campaign-select--menu">
            <span className="visually-hidden">Select or create campaign</span>
            <select
              className="top-bar__button top-bar__select"
              value={activeCampaignId ?? ""}
              onChange={handleTopBarCampaignChange}
            >
              <option value="" disabled>{sortedCampaigns.length === 0 ? "No campaigns" : "Select campaign"}</option>
              <option value="__create__">Create new campaign…</option>
              {sortedCampaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
            </select>
            {isTopBarCreateOpen && (
              <form className="top-bar__create-campaign" onSubmit={handleTopBarCreateCampaignSubmit}>
                <h4>Start a new campaign</h4>
                <label>
                  <span>Campaign name</span>
                  <input
                    type="text"
                    value={topBarCampaignName}
                    onChange={(event) => setTopBarCampaignName(event.target.value)}
                    placeholder="e.g. Stormwreck Expedition"
                    autoFocus
                  />
                </label>
                {topBarCampaignError && <p className="form-error">{topBarCampaignError}</p>}
                <div className="top-bar__create-campaign-actions">
                  <button type="submit" className="primary-button">Create campaign</button>
                  <button type="button" className="secondary-button" onClick={() => setIsTopBarCreateOpen(false)}>Cancel</button>
                </div>
              </form>
            )}
          </label>

          <button type="button" className="top-bar__button">Help</button>
          <button type="button" className="top-bar__button">User</button>
        </div>
      </header>
      <Sidebar
        activeView={activeView}
        isMinimized={isSidebarMinimized}
        onToggleMinimized={() => setIsSidebarMinimized((prev) => !prev)}
        onViewChange={handleViewChange}
        onDownloadState={handleDownloadState}
        onUploadClick={handleUploadClick}
        loadError={loadError}
        fileInputRef={fileInputRef}
        onFileChange={handleFileInputChange}
      />
      <main className="main">
        {activeView === 'campaigns' && campaignView}
        {activeView === 'initiative' && initiativeView}
        {activeView === 'quest-logs' && questLogView}
        {activeView === 'session-logs' && sessionLogsView}
        {activeView === 'treasure-ledger' && treasureLedgerView}
      </main>
    </div>
  )
}

export default App
