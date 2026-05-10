import type { ChangeEvent, FormEvent, RefObject } from 'react'
import { useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { createCampaign as createCampaignAction, setActiveCampaign as setActiveCampaignAction } from '../../store/campaignSlice'
import type { AppDispatch } from '../../store'
import type { RootState } from '../../types'

export type ViewMode = 'initiative' | 'campaigns' | 'quest-logs' | 'session-logs' | 'treasure-ledger'

interface SidebarProps {
  activeView: ViewMode
  onViewChange: (view: ViewMode) => void
  onDownloadState: () => void
  onUploadClick: () => void
  loadError: string
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
}

/**
 * Renders the navigation sidebar that controls view selection and data export/import.
 */
export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onViewChange,
  onDownloadState,
  onUploadClick,
  loadError,
  fileInputRef,
  onFileChange,
}) => {
  const dispatch = useDispatch<AppDispatch>()
  const campaigns = useSelector((state: RootState) => state.campaigns.campaigns)
  const activeCampaignId = useSelector((state: RootState) => state.campaigns.activeCampaignId)
  const [campaignName, setCampaignName] = useState('')
  const [campaignFormError, setCampaignFormError] = useState('')

  const sortedCampaigns = [...campaigns].sort((a, b) => a.createdAt - b.createdAt)

  const handleCreateCampaign = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const name = campaignName.trim()
    if (!name) {
      setCampaignFormError('Name your campaign to begin planning your adventures.')
      return
    }
    dispatch(createCampaignAction({ name }))
    setCampaignName('')
    setCampaignFormError('')
  }

  return (
  <aside className="sidebar">
    <header className="sidebar__header">
      <h1>TTRP campaign assistant</h1>
      <p>Your party control room</p>
    </header>
    <nav className="sidebar__nav">
      <div className="sidebar__campaign-controls">
        <label>
          <span className="sidebar__section">Campaign</span>
          <select
            value={activeCampaignId ?? ''}
            onChange={(event) => dispatch(setActiveCampaignAction(event.target.value))}
          >
            <option value="" disabled>{sortedCampaigns.length === 0 ? 'No campaigns available' : 'Select campaign'}</option>
            {sortedCampaigns.map((campaign) => (
              <option key={campaign.id} value={campaign.id}>{campaign.name}</option>
            ))}
          </select>
        </label>
        <form className="campaign-form campaign-form--compact" onSubmit={handleCreateCampaign}>
          <h4>Start a new campaign</h4>
          <label>
            <span>Campaign name</span>
            <input
              type="text"
              value={campaignName}
              onChange={(event) => setCampaignName(event.target.value)}
              placeholder="e.g. Stormwreck Expedition"
            />
          </label>
          {campaignFormError && <p className="form-error">{campaignFormError}</p>}
          <button type="submit" className="primary-button">Create campaign</button>
        </form>
      </div>
      <span className="sidebar__section">Campaign Tools</span>
      <ul>
        <li>
          <button
            type="button"
            className={`sidebar__item${activeView === 'initiative' ? ' sidebar__item--active' : ''}`}
            onClick={() => onViewChange('initiative')}
          >
            Initiative Tracker
          </button>
        </li>
        <li>
          <button
            type="button"
            className={`sidebar__item${activeView === 'campaigns' ? ' sidebar__item--active' : ''}`}
            onClick={() => onViewChange('campaigns')}
          >
            Combatant Manager
          </button>
        </li>
        <li>
          <button
            type="button"
            className={`sidebar__item${activeView === 'quest-logs' ? ' sidebar__item--active' : ''}`}
            onClick={() => onViewChange('quest-logs')}
          >
            Quest Logs
          </button>
        </li>
        <li>
          <button
            type="button"
            className={`sidebar__item${activeView === 'session-logs' ? ' sidebar__item--active' : ''}`}
            onClick={() => onViewChange('session-logs')}
          >
            Session Logs
          </button>
        </li>
        <li>
          <button
            type="button"
            className={`sidebar__item${activeView === 'treasure-ledger' ? ' sidebar__item--active' : ''}`}
            onClick={() => onViewChange('treasure-ledger')}
          >
            Treasure Ledger
          </button>
        </li>
      </ul>
    </nav>
    <div className="sidebar__global-actions">
      <span className="sidebar__section">Data management</span>
      <div className="save-load-controls save-load-controls--dirty">
        <div className="save-load-actions">
          <button type="button" className="secondary-button" onClick={onDownloadState}>
            Download state
          </button>
          <button type="button" className="ghost-button" onClick={onUploadClick}>
            Upload state
          </button>
        </div>
        <p className="save-load-indicator" role="status" aria-live="polite">
          Unsaved changes detected – download to keep your latest progress.
        </p>
        {loadError && <p className="load-error">{loadError}</p>}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          className="visually-hidden"
          onChange={onFileChange}
        />
      </div>
    </div>
    <footer className="sidebar__footer" aria-hidden="true" />
  </aside>
)}
