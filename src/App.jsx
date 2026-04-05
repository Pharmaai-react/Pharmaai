import { useState, useEffect, useCallback } from 'react';
import { useAppNotifications } from './useAppNotifications.js';
import { loginUser, logoutUser, getCurrentUser } from './userStore.js';
import {
  loadInventory,
  addInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
  applyCartSale,
  resetInventory,
  toInventoryData,
  toMedicineDB,
} from './inventoryStore.js';
import { useNetworkAlerts } from './pharmacyNetwork.js';
import { usePharmacyRooms } from './pharmacyRooms.js';
import { useNotification } from './useNotification.js';
import { supabase } from './supabase.js';
import LoginPage from './components/LoginPage.jsx';
import SignUpPage from './components/SignUpPage.jsx';
import Sidebar, { canAccess } from './components/Sidebar.jsx';
import Dashboard from './components/Dashboard.jsx';
import InventoryPage from './components/InventoryPage.jsx';
import PredictionsPage from './components/PredictionsPage.jsx';
import InteractionsPage from './components/InteractionsPage.jsx';
import SellPage from './components/SellPage.jsx';
import SuppliersPage from './components/SuppliersPage.jsx';
import ReportsPage from './components/ReportsPage.jsx';
import SettingsPage from './components/SettingsPage.jsx';
import NotificationsPage from './components/NotificationsPage.jsx';
import AddMedicationModal from './components/AddMedicationModal.jsx';
import ReorderModal from './components/ReorderModal.jsx';
import ReceiptModal from './components/ReceiptModal.jsx';
import NetworkAlertPanel from './components/NetworkAlertPanel.jsx';
import RoomPanel from './components/RoomPanel.jsx';

// 'login' | 'signup' | 'dashboard'
const AUTH_STATES = { LOGIN: 'login', SIGNUP: 'signup', DASHBOARD: 'dashboard' };

export default function App() {
  const [authState, setAuthState] = useState(AUTH_STATES.LOGIN);
  const [currentUser, setCurrentUser] = useState(null);
  const [currentPage, setCurrentPage] = useState('dashboard');

  // ─── Per-user inventory: loaded lazily once user is authenticated ────────
  const [inventory, setInventory] = useState([]);

  // Derived views — recomputed on every inventory change
  const inventoryData = toInventoryData(inventory);
  const medicineDB = toMedicineDB(inventory);

  // ─── Centralised real-time notifications ────────────────────────────────
  const appNotif = useAppNotifications();
  const { unreadCount, processInventory, notifySale, notifyMedAdded, notifyMedUpdated, notifyReset, notifyInteractionCheck } = appNotif;
  const [openModal, setOpenModal] = useState(null); // 'add' | 'reorder' | 'receipt'
  const [reorderSupplier, setReorderSupplier] = useState(''); // supplier name for the order form
  const [receiptData, setReceiptData] = useState(null);
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
  const [preloadSellItem, setPreloadSellItem] = useState(null); // item to pre-load in Sell
  const [sidebarOpen, setSidebarOpen] = useState(false); // mobile sidebar toggle
  const [salesHistory, setSalesHistory] = useState([]); // persists across page navigation
  const { notifications, showNotification } = useNotification();

  // ─── Dark mode ────────────────────────────────────────────────────────────
  const [darkMode, setDarkMode] = useState(() => {
    try { return localStorage.getItem('pharmaai_theme') === 'dark'; } catch { return false; }
  });
  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.setAttribute('data-theme', 'dark');
      localStorage.setItem('pharmaai_theme', 'dark');
    } else {
      root.removeAttribute('data-theme');
      localStorage.setItem('pharmaai_theme', 'light');
    }
  }, [darkMode]);
  const toggleDarkMode = useCallback(() => setDarkMode(d => !d), []);

  // ─── Pharmacy Network Alerts (unscoped — all pharmacies) ────────────────
  const { networkAlerts, hasNew: hasNewNetwork, dismissAlert, dismissAll, markSeen } =
    useNetworkAlerts(currentUser, inventory);

  // ─── Pharmacy Room System ─────────────────────────────────────────────────
  const rooms = usePharmacyRooms(currentUser, inventory);

  // Handle session restore (page refresh) AND email confirmation redirects
  useEffect(() => {
    // Immediately check for existing session
    getCurrentUser().then(user => {
      if (user) {
        loadInventory(user.id).then(inv => {
          setInventory(inv);
          setCurrentUser(user);
          const defaultPage = canAccess(user.role, 'dashboard') ? 'dashboard' : 'inventory';
          setCurrentPage(defaultPage);
          setAuthState(AUTH_STATES.DASHBOARD);
        });
      }
    });

    // Also listen for auth changes — catches email confirmation redirects
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      if ((event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') && session?.user) {
        const user = await getCurrentUser();
        if (user) {
          const inv = await loadInventory(user.id);
          setInventory(inv);
          setCurrentUser(user);
          const defaultPage = canAccess(user.role, 'dashboard') ? 'dashboard' : 'inventory';
          setCurrentPage(defaultPage);
          setAuthState(AUTH_STATES.DASHBOARD);
        }
      } else if (event === 'SIGNED_OUT') {
        setCurrentUser(null);
        setInventory([]);
        setAuthState(AUTH_STATES.LOGIN);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  // Scan inventory for threshold breaches → fire real-time notifications
  useEffect(() => {
    if (currentUser) {
      processInventory(inventory);
    }
  }, [inventory, currentUser, processInventory]);

  // ─── Auth handlers ────────────────────────────────────────────────────────

  const activateUser = useCallback(async (user) => {
    setCurrentUser(user);
    const inv = await loadInventory(user.id);
    setInventory(inv);
    const defaultPage = canAccess(user.role, 'dashboard') ? 'dashboard' : 'inventory';
    setCurrentPage(defaultPage);
    setAuthState(AUTH_STATES.DASHBOARD);
  }, []);

  const handleLogin = useCallback(async (username, password) => {
    const user = await loginUser(username, password);
    if (!user) return false;
    activateUser(user);
    return true;
  }, [activateUser]);

  const handleSignUp = useCallback((user) => {
    // After successful registration, land directly on dashboard
    activateUser(user);
  }, [activateUser]);

  const handleLogout = useCallback(async () => {
    await logoutUser();
    setCurrentUser(null);
    setInventory([]);
    setCurrentPage('dashboard');
    setProfileDropdownOpen(false);
    setAuthState(AUTH_STATES.LOGIN);
  }, []);

  // ─── Inventory mutations ──────────────────────────────────────────────────

  const handleAddMedication = useCallback(async (item) => {
    const newRecord = await addInventoryItem(currentUser.id, item);
    if (newRecord) {
      // Reload full inventory to guarantee UI is in sync with Supabase
      const updated = await loadInventory(currentUser.id);
      setInventory(updated);
      showNotification(`✅ ${item.name} added to inventory`);
      notifyMedAdded(item.name);
    } else {
      showNotification(`❌ Failed to add ${item.name} — check console for details`);
    }
  }, [currentUser, showNotification, notifyMedAdded]);

  const handleSaleComplete = useCallback(async (cart, receipt) => {
    await applyCartSale(currentUser.id, cart);
    const updated = await loadInventory(currentUser.id);
    setInventory(updated);
    notifySale(cart);
    // Append to today's sales history (persists across page navigation)
    if (receipt) {
      setSalesHistory(prev => [{
        txnId:     receipt.txnId,
        patient:   receipt.patient,
        itemCount: receipt.itemCount || cart.length,
        total:     receipt.total,
        time:      receipt.time,
        payment:   receipt.payment,
      }, ...prev]);
    }
    setReceiptData(receipt);
    setOpenModal('receipt');
  }, [currentUser, notifySale]);

  // Update a single inventory item (from InventoryPage edit modal)
  const handleUpdateItem = useCallback(async (updatedItem) => {
    await updateInventoryItem(updatedItem._id, updatedItem);
    setInventory(prev => prev.map(r => r._id === updatedItem._id ? { ...r, ...updatedItem } : r));
    showNotification(`✅ ${updatedItem.name} updated`);
    notifyMedUpdated(updatedItem.name);
  }, [showNotification, notifyMedUpdated]);

  const handleResetInventory = useCallback(async () => {
    await resetInventory(currentUser.id);
    setInventory([]);
    showNotification('🔄 Inventory cleared');
    notifyReset();
  }, [showNotification, currentUser, notifyReset]);

  // Delete a single medication from inventory
  const handleDeleteItem = useCallback(async (itemName, itemExpiry) => {
    await deleteInventoryItem(currentUser.id, itemName, itemExpiry);
    setInventory(prev => prev.filter(r => !(r.name === itemName && r.expiry === itemExpiry)));
    showNotification(`🗑️ ${itemName} removed from inventory`);
  }, [currentUser, showNotification]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (!e.target.closest('.user-info-sidebar')) {
        setProfileDropdownOpen(false);
      }
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  // ─── Auth screens ─────────────────────────────────────────────────────────

  if (authState === AUTH_STATES.LOGIN) {
    return (
      <>
        <LoginPage
          onLogin={handleLogin}
          onGoToSignUp={() => setAuthState(AUTH_STATES.SIGNUP)}
        />
        <NotificationToasts notifications={notifications} />
      </>
    );
  }

  if (authState === AUTH_STATES.SIGNUP) {
    return (
      <>
        <SignUpPage
          onSignUp={handleSignUp}
          onGoToLogin={() => setAuthState(AUTH_STATES.LOGIN)}
        />
        <NotificationToasts notifications={notifications} />
      </>
    );
  }

  // ─── Main dashboard ───────────────────────────────────────────────────────

  // ─── Page label map for mobile header ────────────────────────────────────
  const PAGE_LABELS = {
    dashboard: 'Dashboard', inventory: 'Inventory', predictions: 'AI Predictions',
    interactions: 'Drug Interactions', sell: 'Sell Medicines', suppliers: 'Suppliers',
    reports: 'Reports', settings: 'Settings', notifications: 'Notifications',
  };

  return (
    <>
      <div className="app-container">
        {/* ── Mobile top header ── */}
        <div className="mobile-topbar">
          <button
            className="hamburger-btn"
            onClick={() => setSidebarOpen(true)}
            aria-label="Open menu"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" width="22" height="22">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <div className="mobile-logo">
            <div className="mobile-logo-icon">
              <svg viewBox="0 0 24 24" fill="white" width="18" height="18"><path d="M19 3H5a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2V5a2 2 0 00-2-2zM12 8v8M8 12h8" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round"/></svg>
            </div>
            <span className="mobile-logo-text">{PAGE_LABELS[currentPage] || 'PharmaAI'}</span>
          </div>
          <button
            className="header-btn"
            onClick={() => setCurrentPage('notifications')}
            style={{ position: 'relative' }}
            aria-label="Notifications"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="18" height="18"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>
            {unreadCount > 0 && <span className="notification-dot" />}
          </button>
        </div>

        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          user={currentUser}
          onLogout={handleLogout}
          notifCount={unreadCount}
          profileDropdownOpen={profileDropdownOpen}
          onToggleProfile={() => setProfileDropdownOpen(p => !p)}
          isOpen={sidebarOpen}
          onClose={() => setSidebarOpen(false)}
        />
        <main className="main-content">
          {currentPage === 'dashboard' && canAccess(currentUser?.role, 'dashboard') && (
            <Dashboard
              user={currentUser}
              inventoryData={inventoryData}
              onNavigate={setCurrentPage}
              onOpenModal={setOpenModal}
              onExport={() => showNotification('Inventory exported to CSV')}
            />
          )}
          {currentPage === 'inventory' && (
            <InventoryPage
              inventoryData={inventoryData}
              onOpenModal={setOpenModal}
              onExport={() => showNotification('Inventory exported to CSV')}
              onResetInventory={handleResetInventory}
              onUpdateItem={handleUpdateItem}
              onDeleteItem={handleDeleteItem}
              onNavigate={setCurrentPage}
              onPreloadSell={(item) => setPreloadSellItem(item)}
            />
          )}
          {currentPage === 'predictions' && canAccess(currentUser?.role, 'predictions') && <PredictionsPage inventoryData={inventoryData} />}
          {currentPage === 'interactions' && canAccess(currentUser?.role, 'interactions') && <InteractionsPage onInteractionChecked={notifyInteractionCheck} />}
          {currentPage === 'sell' && (
            <SellPage
              medicineDB={inventoryData}
              onNavigate={setCurrentPage}
              showNotification={showNotification}
              onSaleComplete={handleSaleComplete}
              salesHistory={salesHistory}
              preloadItem={preloadSellItem}
              onPreloadConsumed={() => setPreloadSellItem(null)}
              currentUser={currentUser}
            />
          )}
          {currentPage === 'suppliers' && canAccess(currentUser?.role, 'suppliers') && (
            <SuppliersPage
              onOpenModal={(modal, supplierName) => {
                setReorderSupplier(supplierName || '');
                setOpenModal(modal);
              }}
              showNotification={showNotification}
              currentUser={currentUser}
            />
          )}
          {currentPage === 'reports' && canAccess(currentUser?.role, 'reports') && (
            <ReportsPage
              inventoryData={inventoryData}
              showNotification={showNotification}
            />
          )}
          {currentPage === 'settings' && canAccess(currentUser?.role, 'settings') && (
            <SettingsPage
              user={currentUser}
              onLogout={handleLogout}
              showNotification={showNotification}
              darkMode={darkMode}
              onToggleDark={toggleDarkMode}
            />
          )}
          {currentPage === 'notifications' && canAccess(currentUser?.role, 'notifications') && (
            <NotificationsPage
              notifications={appNotif.notifications}
              onMarkRead={appNotif.markRead}
              onMarkAllRead={() => { appNotif.markAllRead(); showNotification('All notifications marked as read.'); }}
              onNavigate={setCurrentPage}
            />
          )}
        </main>
      </div>

      {/* Pharmacy Network Alert Panel — scoped to room members only */}
      {(() => {
        // Build set of usernames that share at least one room with current user
        const roomMemberUsernames = new Set(
          (rooms.rooms || [])
            .flatMap(r => r.members.map(m => m.username))
            .filter(u => u !== currentUser?.username)
        );
        // Build a map: username → room names (for tagging alerts)
        const usernameToRooms = {};
        (rooms.rooms || []).forEach(r => {
          r.members.forEach(m => {
            if (m.username !== currentUser?.username) {
              if (!usernameToRooms[m.username]) usernameToRooms[m.username] = [];
              usernameToRooms[m.username].push(r.name);
            }
          });
        });
        // Tag each alert with its room name(s) and filter to room members only
        const scopedAlerts = networkAlerts
          .filter(a => roomMemberUsernames.has(a.fromUsername))
          .map(a => ({ ...a, inRooms: usernameToRooms[a.fromUsername] || [] }));

        return (
          <NetworkAlertPanel
            networkAlerts={scopedAlerts}
            hasNew={hasNewNetwork}
            onDismiss={dismissAlert}
            onDismissAll={dismissAll}
            onMarkSeen={markSeen}
            hasRooms={(rooms.rooms || []).length > 0}
            noRoomsYet={!currentUser || (rooms.rooms || []).length === 0}
          />
        );
      })()}

      {/* Pharmacy Network Rooms */}
      {currentUser && (
        <RoomPanel
          rooms={rooms.rooms}
          totalRoomAlerts={rooms.totalRoomAlerts}
          hasNewRoomAlert={rooms.hasNewRoomAlert}
          currentUser={currentUser}
          onCreateRoom={rooms.createRoom}
          onJoinRoom={rooms.joinRoom}
          onLeaveRoom={rooms.leaveRoom}
          onMarkSeen={rooms.markSeen}
        />
      )}

      {/* Modals */}
      <AddMedicationModal
        isOpen={openModal === 'add'}
        onClose={() => setOpenModal(null)}
        onAdd={handleAddMedication}
        medicineDB={inventoryData}
        showNotification={showNotification}
      />
      <ReorderModal
        isOpen={openModal === 'reorder'}
        onClose={() => { setOpenModal(null); setReorderSupplier(''); }}
        onPlace={(orderData) => {
          setOpenModal(null);
          setReorderSupplier('');
          showNotification(`✅ Order for ${orderData.medication} placed with ${orderData.supplier || 'supplier'}!`);
        }}
        supplierName={reorderSupplier}
        suppliers={[]}
        medicineList={inventoryData}
      />
      <ReceiptModal
        isOpen={openModal === 'receipt'}
        onClose={() => setOpenModal(null)}
        data={receiptData}
      />

      <NotificationToasts notifications={notifications} />
    </>
  );
}

function NotificationToasts({ notifications }) {
  return (
    <>
      {notifications.map(n => (
        <div key={n.id} className={`notification-toast${n.hiding ? ' hiding' : ''}`}>
          {n.message}
        </div>
      ))}
    </>
  );
}
