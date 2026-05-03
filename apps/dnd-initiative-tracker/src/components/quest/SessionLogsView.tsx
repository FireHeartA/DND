import { FormEvent, useMemo, useState } from 'react'
import { useDispatch, useSelector } from 'react-redux'
import { setActiveCampaign as setActiveCampaignAction } from '../../store/campaignSlice'
import type { AppDispatch } from '../../store'
import type { RootState } from '../../types'

type SessionEntry = {
  id: string
  session: string
  summary: string
}

export const SessionLogsView: React.FC = () => {
  const dispatch = useDispatch<AppDispatch>()
  const campaigns = useSelector((state: RootState) => state.campaigns.campaigns)
  const activeCampaignId = useSelector((state: RootState) => state.campaigns.activeCampaignId)

  const [session, setSession] = useState('')
  const [summary, setSummary] = useState('')
  const [status, setStatus] = useState('')
  const [entriesByCampaign, setEntriesByCampaign] = useState<Record<string, SessionEntry[]>>({})
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null)

  const activeCampaign = useMemo(() => {
    return campaigns.find((campaign) => campaign.id === activeCampaignId) || null
  }, [campaigns, activeCampaignId])

  const sortedCampaigns = useMemo(() => {
    return [...campaigns].sort((a, b) => a.name.localeCompare(b.name))
  }, [campaigns])

  const activeEntries = useMemo(() => {
    if (!activeCampaignId) {
      return []
    }
    return entriesByCampaign[activeCampaignId] || []
  }, [entriesByCampaign, activeCampaignId])

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!activeCampaignId) {
      return
    }

    const trimmedSession = session.trim()
    const trimmedSummary = summary.trim()

    if (!trimmedSummary) {
      setStatus('Add a session summary before submitting')
      setTimeout(() => setStatus(''), 2500)
      return
    }

    setEntriesByCampaign((previous) => {
      const existing = previous[activeCampaignId] || []
      return {
        ...previous,
        [activeCampaignId]: [
          {
            id: crypto.randomUUID(),
            session: trimmedSession || 'Session TBD',
            summary: trimmedSummary,
          },
          ...existing,
        ],
      }
    })

    setSession('')
    setSummary('')
    setStatus('Session log added')
    setTimeout(() => setStatus(''), 2500)
  }

  const handleDeleteEntry = (id: string) => {
    if (!activeCampaignId) {
      return
    }

    setEntriesByCampaign((previous) => {
      const existing = previous[activeCampaignId] || []
      return {
        ...previous,
        [activeCampaignId]: existing.filter((entry) => entry.id !== id),
      }
    })
    setPendingDeleteId((current) => (current === id ? null : current))
  }

  return (
    <section className="quest-log">
      <header className="quest-log__header">
        <div>
          <p className="eyebrow">Campaign journal</p>
          <h2>Session Logs</h2>
        </div>
      </header>

      <section className="campaign-panel">
        <h3 className="campaign-panel__title">Campaigns</h3>
        {sortedCampaigns.length > 0 ? (
          <label>
            <span>Campaign</span>
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
            value={session}
            onChange={(event) => setSession(event.target.value)}
          />

          <label className="quest-log__label" htmlFor="session-log-summary">
            Session summary
          </label>
          <textarea
            id="session-log-summary"
            className="quest-log__textarea"
            placeholder="Capture highlights, roleplay moments, and important outcomes..."
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
          />
        </div>
        <div className="quest-log__actions">
          <button type="submit" className="primary-button">
            Save session log
          </button>
          {status && <span className="quest-log__status">{status}</span>}
        </div>
      </form>

      <div className="quest-log__entries" aria-live="polite">
        {activeEntries.length > 0 ? (
          activeEntries.map((entry) => (
            <article key={entry.id} className="quest-log__entry">
              {pendingDeleteId === entry.id ? (
                <div className="quest-log__inline-confirm">
                  <button
                    type="button"
                    className="primary-button"
                    onClick={() => handleDeleteEntry(entry.id)}
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    className="ghost-button"
                    onClick={() => setPendingDeleteId(null)}
                  >
                    No
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="quest-log__delete-button"
                  aria-label="Delete session log"
                  onClick={() => setPendingDeleteId(entry.id)}
                >
                  ×
                </button>
              )}
              <div className="quest-log__entry-body">
                <h3 className="quest-log__entry-title">{entry.session}</h3>
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
