import type { ChangeEvent, RefObject } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setActiveCampaign as setActiveCampaignAction } from '../../store/campaignSlice'
import type { AppDispatch } from '../../store'
import type { RootState } from '../../types'

export type ViewMode = 'initiative' | 'players' | 'monsters' | 'npcs' | 'quest-logs' | 'session-logs' | 'treasure-ledger'

interface SidebarProps {
  activeView: ViewMode
  isMinimized: boolean
  onToggleMinimized: () => void
  onViewChange: (view: ViewMode) => void
  onDownloadState: () => void
  onUploadClick: () => void
  loadError: string
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  onOpenCreateCampaignModal: () => void
}

const CREATE_CAMPAIGN_OPTION = '__create_new_campaign__'

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  isMinimized,
  onToggleMinimized,
  onViewChange,
  onDownloadState,
  onUploadClick,
  loadError,
  fileInputRef,
  onFileChange,
  onOpenCreateCampaignModal,
}) => {
  const dispatch = useDispatch<AppDispatch>()
  const campaigns = useSelector((state: RootState) => state.campaigns.campaigns)
  const activeCampaignId = useSelector((state: RootState) => state.campaigns.activeCampaignId)

  const sortedCampaigns = [...campaigns].sort((a, b) => a.createdAt - b.createdAt)

  const handleCampaignSelectionChange = (event: ChangeEvent<HTMLSelectElement>) => {
    const selectedCampaignId = event.target.value
    if (selectedCampaignId === CREATE_CAMPAIGN_OPTION) {
      onOpenCreateCampaignModal()
      return
    }

    dispatch(setActiveCampaignAction(selectedCampaignId))
  }

  return (<aside className={`sidebar${isMinimized ? ' sidebar--minimized' : ''}`}>
    <button type="button" className="sidebar__toggle" onClick={onToggleMinimized} title="minimise" aria-label="minimise">☰</button>
    {!isMinimized && <>
      <nav className="sidebar__nav">
        <div className="sidebar__campaign-controls">
          <label>
            <span className="sidebar__section">Campaign</span>
            <select value={activeCampaignId ?? ''} onChange={handleCampaignSelectionChange}>
              <option value="" disabled>{sortedCampaigns.length === 0 ? 'No campaigns available' : 'Select campaign'}</option>
              {sortedCampaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
              ))}
              <option value={CREATE_CAMPAIGN_OPTION}>+ Create new campaign</option>
            </select>
          </label>
        </div>
        <span className="sidebar__section">Campaign Overview</span>
        <ul>
          <li><button type="button" className={`sidebar__item${activeView === 'players' ? ' sidebar__item--active' : ''}`} onClick={() => onViewChange('players')}>Player Characters</button></li>
          <li><button type="button" className={`sidebar__item${activeView === 'monsters' ? ' sidebar__item--active' : ''}`} onClick={() => onViewChange('monsters')}>Monsters</button></li>
          <li><button type="button" className={`sidebar__item${activeView === 'npcs' ? ' sidebar__item--active' : ''}`} onClick={() => onViewChange('npcs')}>NPC</button></li>
        </ul>
        <hr className="sidebar__divider" />
        <span className="sidebar__section">Session Tools</span>
        <ul>
          <li><button type="button" className={`sidebar__item${activeView === 'initiative' ? ' sidebar__item--active' : ''}`} onClick={() => onViewChange('initiative')}>Initiative Tracker</button></li>
          <li><button type="button" className={`sidebar__item${activeView === 'quest-logs' ? ' sidebar__item--active' : ''}`} onClick={() => onViewChange('quest-logs')}>Quest Log</button></li>
          <li><button type="button" className={`sidebar__item${activeView === 'session-logs' ? ' sidebar__item--active' : ''}`} onClick={() => onViewChange('session-logs')}>Session Logs</button></li>
          <li><button type="button" className={`sidebar__item${activeView === 'treasure-ledger' ? ' sidebar__item--active' : ''}`} onClick={() => onViewChange('treasure-ledger')}>Treasure Ledger</button></li>
          <li><span className="sidebar__item sidebar__item--disabled">Encounter Builder</span></li>
        </ul>
      </nav>
      <div className="sidebar__global-actions">
        <span className="sidebar__section">Data management</span>
        <div className="save-load-controls save-load-controls--dirty">
          <div className="save-load-actions">
            <button type="button" className="secondary-button" onClick={onDownloadState}>Download state</button>
            <button type="button" className="ghost-button" onClick={onUploadClick}>Upload state</button>
          </div>
          <p className="save-load-indicator" role="status" aria-live="polite">Unsaved changes detected – download to keep your latest progress.</p>
          {loadError && <p className="load-error">{loadError}</p>}
          <input ref={fileInputRef} type="file" accept="application/json" className="visually-hidden" onChange={onFileChange} />
        </div>
      </div>
      <footer className="sidebar__footer" aria-hidden="true" />
    </>}
  </aside>)
}
