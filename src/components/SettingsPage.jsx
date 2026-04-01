export default function SettingsPage({ user, onLogout, showNotification }) {
  return (
    <>
      <header className="header">
        <div className="header-left">
          <h1>Settings</h1>
          <p>Configure your PharmaAI preferences</p>
        </div>
      </header>

      <div className="settings-section">
        <div className="settings-section-title">Profile &amp; Account</div>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>{user?.name}</h4>
            <p>{user?.role} · {user?.username}@pharmaai.com</p>
          </div>
          <button className="btn btn-secondary" onClick={() => showNotification('Profile editing coming soon!')}>Edit Profile</button>
        </div>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Change Password</h4>
            <p>Last changed 30 days ago</p>
          </div>
          <button className="btn btn-secondary" onClick={() => showNotification('Password change dialog coming soon!')}>Change</button>
        </div>
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Notifications</div>
        <ToggleRow label="Low Stock Alerts" desc="Get notified when items fall below threshold" defaultChecked />
        <ToggleRow label="Expiry Notifications" desc="Alert 30 days before medication expiry" defaultChecked />
        <ToggleRow label="AI Insight Emails" desc="Weekly AI summary email report" />
      </div>

      <div className="settings-section">
        <div className="settings-section-title">System</div>
        <ToggleRow label="Dark Mode" desc="Switch to dark theme" />
        <ToggleRow label="Auto Backup" desc="Daily automatic data backup" defaultChecked />
      </div>

      <div className="settings-section">
        <div className="settings-section-title">Danger Zone</div>
        <div className="settings-row">
          <div className="settings-row-info">
            <h4>Sign Out</h4>
            <p>Log out of PharmaAI on this device</p>
          </div>
          <button className="btn btn-danger" onClick={onLogout}>Sign Out</button>
        </div>
      </div>
    </>
  );
}

function ToggleRow({ label, desc, defaultChecked = false }) {
  return (
    <div className="settings-row">
      <div className="settings-row-info">
        <h4>{label}</h4>
        <p>{desc}</p>
      </div>
      <label className="toggle">
        <input type="checkbox" defaultChecked={defaultChecked} />
        <span className="toggle-slider" />
      </label>
    </div>
  );
}
