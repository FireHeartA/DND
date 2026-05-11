import { useSelector } from 'react-redux'
import type { RootState } from '../../types'

export const PlayerCharactersView: React.FC = () => {
  const campaigns = useSelector((state: RootState) => state.campaigns.campaigns)
  const activeCampaignId = useSelector((state: RootState) => state.campaigns.activeCampaignId)
  const activeCampaign = campaigns.find((campaign) => campaign.id === activeCampaignId)

  return (
    <section className="campaign-manager">
      <header className="campaign-manager__header">
        <h2>Campaign Players</h2>
      </header>

      <article className="campaign-card">
        <h3>Import Player Characters</h3>
        <label>Player Character URL</label>
        <input type="url" placeholder="https://www.dndbeyond.com/characters/..." />
        <div className="row-actions">
          <button type="button" className="primary-button">Import player character</button>
          <button type="button" className="ghost-button">Clear</button>
        </div>
      </article>

      <article className="campaign-card">
        <h3>Add a player character</h3>
        <button type="button" className="ghost-button">Minimize</button>
        <label>Player URL</label>
        <p>Paste a D&amp;D Beyond character URL to import player characters.</p>
        <input type="url" placeholder="https://www.dndbeyond.com/characters/..." />
        <button type="button" className="secondary-button">Import player data</button>
        <label>Name</label>
        <input type="text" placeholder="Fighter name" />
        <label>Max HP</label>
        <input type="number" defaultValue={45} />
        <label>Armor Class</label>
        <input type="number" defaultValue={15} />
        <label>Player Level</label>
        <input type="number" defaultValue={5} />
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
      </article>

      <article className="campaign-card">
        <h3>Saved player characters</h3>
        <p>Reuse your heroes across sessions with a single click.</p>
        <ul>
          {(activeCampaign?.playerCharacters ?? []).map((player) => (
            <li key={player.id}>{player.name}</li>
          ))}
        </ul>
      </article>
    </section>
  )
}
