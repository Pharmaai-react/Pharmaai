import { PharmacyIcon, BoxIcon, TrendIcon, InfoIcon, ShoppingIcon, UsersIcon, FileTextIcon, SettingsIcon, BellIcon, LogoutIcon } from '../Icons.jsx';

// ── Role-based access control ────────────────────────────────────────────────
export const ROLE_ALLOWED_PAGES = {
  'Staff Member': new Set(['inventory', 'sell']),
};

/** Returns true if the user's role is allowed to view this page */
export function canAccess(role, page) {
  if (!role) return true;
  const allowed = ROLE_ALLOWED_PAGES[role];
  if (!allowed) return true;
  return allowed.has(page);
}

// ── Nav definition ───────────────────────────────────────────────────────────
const navItems = [
  { id: 'dashboard',     label: 'Dashboard',        section: 'Main Menu',   icon: <DashboardIcon /> },
  { id: 'inventory',     label: 'Inventory',         section: 'Main Menu',   icon: <BoxIcon size={18} /> },
  { id: 'predictions',   label: 'AI Predictions',    section: 'Main Menu',   icon: <TrendIcon size={18} /> },
  { id: 'interactions',  label: 'Drug Interactions', section: 'Main Menu',   icon: <InfoIcon size={18} /> },
  { id: 'sell',          label: 'Sell Medicines',    section: 'Main Menu',   isSell: true, icon: <ShoppingIcon size={18} /> },
  { id: 'suppliers',     label: 'Suppliers',         section: 'Management',  icon: <UsersIcon size={18} /> },
  { id: 'reports',       label: 'Reports',           section: 'Management',  icon: <FileTextIcon size={18} /> },
  { id: 'settings',      label: 'Settings',          section: 'Management',  icon: <SettingsIcon size={18} /> },
  { id: 'notifications', label: 'Notifications',     section: 'Alerts',      isNotif: true, icon: <BellIcon size={18} /> },
];

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18">
      <rect x="3"  y="3"  width="7" height="7" rx="1" />
      <rect x="14" y="3"  width="7" height="7" rx="1" />
      <rect x="14" y="14" width="7" height="7" rx="1" />
      <rect x="3"  y="14" width="7" height="7" rx="1" />
    </svg>
  );
}

export default function Sidebar({
  currentPage, onNavigate, user, onLogout,
  notifCount, profileDropdownOpen, onToggleProfile,
  isOpen, onClose,
}) {
  const role = user?.role;
  const sections = ['Main Menu', 'Management', 'Alerts'];
  const visibleItems = navItems.filter(item => canAccess(role, item.id));

  const handleNavigate = (page) => {
    onNavigate(page);
    if (onClose) onClose();
  };

  return (
    <>
      {/* Mobile overlay backdrop — only rendered on mobile when open */}
      {isOpen && <div className="sidebar-overlay" onClick={onClose} />}

      <aside className={`sidebar${isOpen ? ' sidebar-open' : ''}`}>
        {/* Logo row */}
        <div className="logo">
          <div className="logo-icon">
            <PharmacyIcon size={24} fill="white" />
          </div>
          <span className="logo-text">PharmaAI</span>
          {/* Mobile ✕ close button — hidden on desktop via CSS */}
          <button className="sidebar-mobile-close" onClick={onClose} aria-label="Close menu">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="20" height="20">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Role badge for restricted accounts */}
        {ROLE_ALLOWED_PAGES[role] && (
          <div className="role-access-badge">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="12" height="12">
              <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
              <path d="M7 11V7a5 5 0 0 1 10 0v4" />
            </svg>
            {role} Access
          </div>
        )}

        {/* Nav sections */}
        {sections.map(section => {
          const items = visibleItems.filter(i => i.section === section);
          if (items.length === 0) return null;
          return (
            <nav className="nav-section" key={section}>
              <div className="nav-label">{section}</div>
              {items.map(item => (
                <button
                  key={item.id}
                  className={`nav-item${currentPage === item.id ? ' active' : ''}`}
                  style={item.isSell && currentPage !== item.id
                    ? { background: 'linear-gradient(135deg,#0d9488,#0891b2)', color: 'white', marginTop: '4px', fontWeight: 700 }
                    : {}}
                  data-page={item.id}
                  onClick={() => handleNavigate(item.id)}
                >
                  {item.icon}
                  {item.label}
                  {item.isNotif && notifCount > 0 && (
                    <span className="nav-badge">{notifCount}</span>
                  )}
                </button>
              ))}
            </nav>
          );
        })}

        {/* Footer: user info + logout */}
        <div className="sidebar-footer">
          <div className="user-info-sidebar" onClick={onToggleProfile}>
            <div className="user-avatar-sm">{user?.initials}</div>
            <div className="user-details">
              <div className="user-name">{user?.name}</div>
              <div className="user-role">{user?.role}</div>
            </div>
            <button
              className="logout-btn-inline"
              onClick={(e) => { e.stopPropagation(); onLogout(); }}
              title="Logout"
            >
              <LogoutIcon size={16} />
            </button>
          </div>

          {profileDropdownOpen && (
            <div className="profile-dropdown">
              {canAccess(role, 'settings') && (
                <button className="profile-dropdown-item" onClick={() => onNavigate('settings')}>
                  <SettingsIcon size={16} /> Account Settings
                </button>
              )}
              <button className="profile-dropdown-item danger" onClick={onLogout}>
                <LogoutIcon size={16} /> Logout
              </button>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}
