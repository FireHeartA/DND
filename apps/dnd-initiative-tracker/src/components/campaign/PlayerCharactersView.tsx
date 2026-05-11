import { useState } from 'react'
import { useSelector } from 'react-redux'
import type { RootState } from '../../types'

export const PlayerCharactersView: React.FC = () => {
  const campaigns = useSelector((state: RootState) => state.campaigns.campaigns)
  const activeCampaignId = useSelector((state: RootState) => state.campaigns.activeCampaignId)
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId)

  const [importMinimized, setImportMinimized] = useState(false)
  const [manualMinimized, setManualMinimized] = useState(false)

  return (
    <section className="campaign-manager">
      <header className="campaign-manager__header">
        <h2>Campaign Players</h2>
      </header>

      <article className="campaign-form campaign-form--compact">
        <div className="section-header">
          <h4>Import player characters</h4>
          <button
            type="button"
            className="section-toggle"
            onClick={() => setImportMinimized((current) => !current)}
          >
            {importMinimized ? 'Expand' : 'Minimize'}
          </button>
        </div>
        {!importMinimized && (
          <>
            <label>Player Character URL</label>
            <input type="url" placeholder="https://www.dndbeyond.com/characters/..." />
            <div className="row-actions">
              <button type="button" className="primary-button">Import player character</button>
              <button type="button" className="ghost-button">Clear</button>
            </div>
          </>
        )}
      </article>

      <article className="campaign-form">
        <div className="section-header">
          <h4>Add player characters manually</h4>
          <button
            type="button"
            className="section-toggle"
            onClick={() => setManualMinimized((current) => !current)}
          >
            {manualMinimized ? 'Expand' : 'Minimize'}
          </button>
        </div>
        {!manualMinimized && (
          <>
            <label>Player URL</label>
            <p className="form-hint">Paste a D&amp;D Beyond character URL to import player characters.</p>
            <input type="url" placeholder="https://www.dndbeyond.com/characters/..." />
            <button type="button" className="secondary-button">Import player data</button>
            <div className="campaign-form__grid">
              <label>
                Name
                <input type="text" placeholder="Fighter name" />
              </label>
              <label>
                Max HP
                <input type="number" defaultValue={45} />
              </label>
              <label>
                Armor Class
                <input type="number" defaultValue={15} />
              </label>
              <label>
                Player Level
                <input type="number" defaultValue={5} />
              </label>
            </div>
            <label>Character link</label>
            <input type="url" placeholder="https://www.dndbeyond.com/characters/..." />
            <label>Notes</label>
            <textarea placeholder="Personality, spell slots, reminders..." />
            <h4>Immunities</h4>
            <button type="button" className="secondary-button">Add a defense</button>
            <p>No selections yet.</p>
            <h4>Resistances</h4>
            <button type="button" className="secondary-button">Add a defense</button>
            <p>No selections yet.</p>
            <h4>Vulnerabilities</h4>
            <button type="button" className="secondary-button">Add a defense</button>
            <p>No selections yet.</p>
            <h4>Tags</h4>
            <p>No tags yet.</p>
            <input type="text" placeholder="Add a tag and press Enter" />
            <button type="button" className="secondary-button">Add tag</button>
            <div className="row-actions">
              <button type="button" className="primary-button">Add to roster</button>
              <button type="button" className="ghost-button">Clear</button>
            </div>
          </>
        )}
      </article>

      <article className="campaign-form campaign-form--compact">
        <h4>Saved player characters</h4>
        <p className="form-hint">Reuse your heroes across sessions with a single click.</p>
        <ul>
          {(activeCampaign?.playerCharacters ?? []).map((player) => (
            <li key={player.id}>{player.name}</li>
          ))}
        </ul>
      </article>

      <article className="campaign-form campaign-form--compact">
        <h4>View &amp; edit player character</h4>
        <p className="form-hint">Select a saved character to view details and update them.</p>
        <label>Selected player</label>
        <select defaultValue="">
          <option value="" disabled>
            Choose a saved character
          </option>
          {(activeCampaign?.playerCharacters ?? []).map((player) => (
            <option key={player.id} value={player.id}>
              {player.name}
            </option>
          ))}
        </select>
        <div className="row-actions">
          <button type="button" className="secondary-button">Load character</button>
          <button type="button" className="primary-button">Save updates</button>
        </div>
      </article>
    </section>
  )
}
