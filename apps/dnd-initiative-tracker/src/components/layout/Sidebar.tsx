import type { ChangeEvent, RefObject } from 'react'

export type ViewMode = 'initiative' | 'campaigns'

interface SidebarProps {
  activeView: ViewMode
  onViewChange: (view: ViewMode) => void
  onDownloadState: () => void
  onUploadClick: () => void
  loadError: string
  fileInputRef: RefObject<HTMLInputElement | null>
  onFileChange: (event: ChangeEvent<HTMLInputElement>) => void
  isDirty: boolean
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
  isDirty,
}) => (
  <aside className="sidebar">
    <header className="sidebar__header">
      <h1>TTRP campaign assistant</h1>
      <p>Your party control room</p>
    </header>
    <nav className="sidebar__nav">
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
          <span className="sidebar__item sidebar__item--disabled">Quest Log (coming soon)</span>
        </li>
        <li>
          <span className="sidebar__item sidebar__item--disabled">Treasure Ledger (coming soon)</span>
        </li>
      </ul>
    </nav>
    <div className="sidebar__global-actions">
      <span className="sidebar__section">Data management</span>
      <div className={`save-load-controls${isDirty ? ' save-load-controls--dirty' : ''}`}>
        <div className="save-load-actions">
          <button type="button" className="secondary-button" onClick={onDownloadState}>
            Download state
          </button>
          <button type="button" className="ghost-button" onClick={onUploadClick}>
            Upload state
          </button>
        </div>
        {isDirty && (
          <p className="save-load-indicator" role="status" aria-live="polite">
            Unsaved changes detected – download to keep your latest progress.
          </p>
        )}
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
)
