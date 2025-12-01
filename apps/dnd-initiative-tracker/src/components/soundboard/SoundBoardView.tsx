import React from 'react'

export const SoundBoardView: React.FC = () => (
  <>
    <section className="main__header">
      <div>
        <h2>Sound Board</h2>
        <p>Organize ambient tracks and effects to keep every session immersive.</p>
      </div>
    </section>

    <section className="campaign-section">
      <header className="campaign-section__header">
        <div>
          <h3>Sound board</h3>
          <p>Build playlists, trigger stingers, and prep your go-to background audio.</p>
        </div>
      </header>
      <div className="campaign-section__content">
        <div className="campaign-manager__empty-list">
          <p>
            The sound board is on the way. Soon you&apos;ll be able to save ambience, battle
            music, and sound effects to launch at the perfect moment.
          </p>
        </div>
      </div>
    </section>
  </>
)
