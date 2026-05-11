export const CampaignMonstersView: React.FC = () => {
  return (
    <section className="campaign-manager">
      <header className="campaign-manager__header">
        <h2>Campaign Monsters</h2>
      </header>
      <article className="campaign-card">
        <h3>Import monster from external source</h3>
        <label>Monster URL</label>
        <input type="url" defaultValue="https://www.dndbeyond.com/monsters/ancient-red-dragon" />
        <div className="row-actions">
          <button type="button" className="primary-button">Import monster</button>
          <button type="button" className="ghost-button">Clear</button>
        </div>
      </article>
      <article className="campaign-card">
        <h3>Add monster manually</h3>
        <button type="button" className="ghost-button">Minimize</button>
        <label>Name</label><input type="text" />
        <label>Creature Type</label><input type="text" defaultValue="Large dragon, chaotic evil" />
        <label>Armor Class</label><input type="text" />
        <label>Hit Points</label><input type="text" />
        <label>Speed</label><input type="text" defaultValue="40 ft., fly 80 ft." />
        <label>Challenge Rating</label><input type="text" defaultValue="17" />
        <label>Challenge XP</label><input type="text" defaultValue="18000" />
        <label>Senses</label><input type="text" />
        <label>Languages</label><input type="text" />
        <label>Source URL</label><input type="url" />
        <label>Tags (comma separated)</label><input type="text" />
        <label>Notes</label><textarea />
        <h4>Immunities</h4><button type="button" className="secondary-button">Add a defense</button><p>No selections yet.</p>
        <h4>Resistances</h4><button type="button" className="secondary-button">Add a defense</button><p>No selections yet.</p>
        <h4>Vulnerabilities</h4><button type="button" className="secondary-button">Add a defense</button><p>No selections yet.</p>
        <div className="row-actions"><button type="button" className="primary-button">Add monster</button><button type="button" className="ghost-button">Clear</button></div>
      </article>
      <article className="campaign-card">
        <h3>Saved Campaign Monsters</h3>
        <p>Keep your frequently used foes ready for quick initiative drops.</p>
      </article>
    </section>
  )
}
