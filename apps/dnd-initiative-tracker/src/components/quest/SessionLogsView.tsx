import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { 
  setActiveCampaign as setActiveCampaignAction,
  updateCampaignSessionLogs as updateCampaignSessionLogsAction, 
} from '../../store/campaignSlice'
import type { AppDispatch } from '../../store'
import type { RootState, SessionLogEntry } from '../../types'

export const SessionLogsView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const campaigns = useSelector((state: RootState) => state.campaigns.campaigns)
  const activeCampaignId = useSelector((state: RootState) => state.campaigns.activeCampaignId)

  const [newSession, setNewSession] = useState('')
  const [newSessionSummary, setNewSessionSummary] = useState('')
  const [validationError, setValidationError] = useState('')
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)
  const [editEntryId, setEditEntryId] = useState<string | null>(null)


  const activeCampaign = useMemo(() => {
    return campaigns.find((campaign) => campaign.id === activeCampaignId) || null
  }, [campaigns, activeCampaignId])

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => a.name.localeCompare(b.name))
  }, [campaigns])

  const campaignSessionLogs = useMemo(() => {
    if (!activeCampaignId || !activeCampaign) {
      return []
    }
    return activeCampaign.sessionLogs || []
  }, [activeCampaign, activeCampaignId])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeCampaignId) {
      setValidationError('Choose a campaign before saving quests')
      setTimeout(() => setValidationError(''), 2500)
      return
    }
    const trimmedSession = newSession.trim()
    const trimmedSummary = newSessionSummary.trim()
    if (!trimmedSummary || !trimmedSession) {
      setValidationError('Add all fields before submitting')
      setTimeout(() => setValidationError(''), 2500)
      return
    }

    const existingSessionLogs = activeCampaign?.sessionLogs || [];

    let updatedSessionLogs: SessionLogEntry[] = [];
    if(!editEntryId) {
      const newSessionToAdd : SessionLogEntry = { id: crypto.randomUUID(), session: trimmedSession , summary: trimmedSummary };
      updatedSessionLogs = [...existingSessionLogs, newSessionToAdd];
    } else {
      updatedSessionLogs = existingSessionLogs.map((entry) => {
        if (entry.id === editEntryId) {
          return { ...entry, session: trimmedSession, summary: trimmedSummary }
        }
        return entry
      })
    }

    dispatch(
      updateCampaignSessionLogsAction({
        id: activeCampaignId,
        sessionLogs: updatedSessionLogs,
      }),
    )

    setNewSession('')
    setNewSessionSummary('')
    setEditEntryId(null)
    setValidationError('Session log added')
    setTimeout(() => setValidationError(''), 2500)
  }

  const handleDeleteEntry = (id: string) => {
    if (pendingDeleteId === id) {
      return
    }
    setPendingDeleteId(id)
  }

  const confirmDeleteEntry = (id: string) => {
    if (!activeCampaignId) {
      return
    }
    if(pendingDeleteId !== id) {
      // sanity check    
      return
    }
    
    const existingSessionLogs = activeCampaign?.sessionLogs || [];

    dispatch(
      updateCampaignSessionLogsAction({
        id: activeCampaignId,
        sessionLogs: existingSessionLogs.filter((entry) => entry.id !== pendingDeleteId),
      }),
    );

    setPendingDeleteId(null)
  }

  
  const cancelDeleteEntry = () => {
    setPendingDeleteId(null)
  }

  const handleEdit = (entry: SessionLogEntry) => {
    setNewSession(entry.session);
    setNewSessionSummary(entry.summary);
    setEditEntryId(entry.id);
  } 
  
  return (
    <section className="quest-log">
      <header className="quest-log__header">
        <div>
          <h2>Session Logs</h2>
        </div>
      </header>

      <section className="campaign-panel">
        <h3 className="campaign-panel__title">Campaigns</h3>
        {sortedCampaigns.length > 0 ? (
          <label>
            <select
              value={activeCampaign ? activeCampaign.id : ''}
              onChange={(event) => dispatch(setActiveCampaignAction(event.target.value))}
            >
              <option value="" disabled>
                Select campaign
              </option>
              {sortedCampaigns.map((campaign) => (
                <option key={campaign.id} value={campaign.id}>
                  {campaign.name}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <p className="quest-log__empty">No campaigns available yet. Create one in Campaign Manager first.</p>
        )}
        {activeCampaign && <p className="quest-log__status">Showing session logs for: {activeCampaign.name}</p>}
      </section>

      <form className="quest-log__form" onSubmit={handleSubmit}>
        <div className="quest-log__scroll" aria-label="Session tracker editor">
          <label className="quest-log__label" htmlFor="session-log-session">
            Session Tracker
          </label>
          <input
            id="session-log-session"
            className="quest-log__input"
            placeholder="e.g. Session 7"
            value={newSession}
            onChange={(event) => setNewSession(event.target.value)}
          />

          <label className="quest-log__label" htmlFor="session-log-summary">
            Session summary
          </label>
          <textarea
            id="session-log-summary"
            className="quest-log__textarea"
            placeholder="Capture highlights, roleplay moments, and important outcomes..."
            value={newSessionSummary}
            onChange={(event) => setNewSessionSummary(event.target.value)}
          />
        </div>
        <div className="quest-log__actions">
          <button type="submit" className="primary-button">
            {editEntryId ? 'Update session log' : 'Add new session log'}
          </button>
          {validationError && <span className="quest-log__status">{validationError}</span>}
        </div>
      </form>

      <div className="quest-log__entries" aria-live="polite">
        {campaignSessionLogs.length > 0 ? (
          campaignSessionLogs.map((entry) => (
            <article key={entry.id} className="quest-log__entry">
              <div className="quest-log__entry-body">
                <div className="treasure-ledger__entry-top">
                <h3 className="quest-log__entry-title">{entry.session}</h3>
                  {pendingDeleteId === entry.id ? (
                    <div className="quest-log__inline-confirm">
                      <button type="button" className="primary-button" onClick={() => confirmDeleteEntry(entry.id)}>
                        Yes
                      </button>
                      <button type="button" className="ghost-button" onClick={cancelDeleteEntry}>
                        No
                      </button>
                    </div>
                  ) : (
                    <div>
                      <button type="button" className="primary-button" onClick={() => handleEdit(entry)}>Edit entry</button>
                      <button
                        type="button"
                        className="quest-log__delete-button"
                        aria-label="Delete session log"
                        onClick={() => handleDeleteEntry(entry.id)}
                        >
                        ×
                      </button>
                    </div>
                  )}
                </div>
                <p className="quest-log__entry-text">{entry.summary}</p>
              </div>
            </article>
          ))
        ) : (
          <p className="quest-log__empty">No session logs submitted yet.</p>
        )}
      </div>
    </section>
  )
}
