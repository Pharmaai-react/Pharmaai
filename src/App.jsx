import { useState, useEffect, useCallback } from 'react';
import { useAppNotifications } from './useAppNotifications.js';
import { loginUser } from './userStore.js';
import {
  loadInventory,
  saveInventory,
  resetInventory,
  applyCartSale,
  toInventoryData,
  toMedicineDB,
} from './inventoryStore.js';
import { useNetworkAlerts } from './pharmacyNetwork.js';
import { useNotification } from './useNotification.js';
import LoginPage from './components/LoginPage.jsx';
import SignUpPage from './components/SignUpPage.jsx';
import Sidebar from './components/Sidebar.jsx';
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

  // ─── Pharmacy Network ─────────────────────────────────────────────────────
  const { networkAlerts, hasNew, dismissAlert, dismissAll, markSeen } = useNetworkAlerts(
    currentUser?.username ?? null,
    currentUser?.pharmacyName ?? '',
    inventory,
  );

  // Persist to the user-scoped localStorage key on every inventory change
  // Also scan for threshold breaches → fire real-time notifications
  useEffect(() => {
    if (currentUser) {
      saveInventory(inventory, currentUser.username);
      processInventory(inventory);
    }
  }, [inventory, currentUser, processInventory]);

  // ─── Auth handlers ────────────────────────────────────────────────────────

  const activateUser = useCallback((user) => {
    setCurrentUser(user);
    // Load this pharmacy's inventory (isolated per username)
    setInventory(loadInventory(user.username));
    setCurrentPage('dashboard');
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

  const handleLogout = useCallback(() => {
    setCurrentUser(null);
    setInventory([]);
    setCurrentPage('dashboard');
    setProfileDropdownOpen(false);
    setAuthState(AUTH_STATES.LOGIN);
  }, []);

  // ─── Inventory mutations ──────────────────────────────────────────────────

  const handleAddMedication = useCallback((med) => {
    setInventory((prev) => {
      const newRec = {
        barcode: med.barcode,
        name: med.name,
        category: med.category,
        price: med.price,
        unit: med.unit,
        quantity: med.quantity,
        baseQuantity: med.quantity,
        expiry: med.expiry,
        stock: Math.min(100, Math.round((med.quantity / med.quantity) * 100)),
        status: med.status || 'in-stock',
        lastUpdated: new Date().toISOString(),
      };
      return [newRec, ...prev];
    });
    showNotification('✅ ' + med.name + ' added to inventory!');
    notifyMedAdded(med);
  }, [showNotification, notifyMedAdded]);

  const handleSaleComplete = useCallback((cartItems, saleData) => {
    setInventory((prev) => applyCartSale(prev, cartItems));
    if (saleData) notifySale(saleData);
  }, [notifySale]);

  // Update a single inventory item (from InventoryPage edit modal)
  const handleUpdateItem = useCallback((updatedItem) => {
    setInventory(prev =>
      prev.map(rec => rec.name === updatedItem.name ? { ...rec, ...updatedItem } : rec)
    );
    showNotification('✅ ' + updatedItem.name + ' updated');
    notifyMedUpdated(updatedItem);
  }, [showNotification, notifyMedUpdated]);

  const handleResetInventory = useCallback(() => {
    setInventory(resetInventory(currentUser?.username));
    showNotification('🔄 Inventory reset to initial data');
    notifyReset();
  }, [showNotification, currentUser, notifyReset]);

  // Delete a single medication from inventory
  const handleDeleteItem = useCallback((itemName, itemExpiry) => {
    setInventory(prev => prev.filter(rec => {
      // Remove only the exact batch: same name AND same expiry date
      return !(rec.name === itemName && rec.expiry === itemExpiry);
    }));
    showNotification(`🗑️ ${itemName} (expiry: ${itemExpiry}) removed from inventory`);
  }, [showNotification]);

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

  return (
    <>
      <div className="app-container">
        <Sidebar
          currentPage={currentPage}
          onNavigate={setCurrentPage}
          user={currentUser}
          onLogout={handleLogout}
          notifCount={unreadCount}
          profileDropdownOpen={profileDropdownOpen}
          onToggleProfile={() => setProfileDropdownOpen(p => !p)}
        />
        <main className="main-content">
          {currentPage === 'dashboard' && (
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
          {currentPage === 'predictions' && <PredictionsPage inventoryData={inventoryData} />}
          {currentPage === 'interactions' && <InteractionsPage onInteractionChecked={notifyInteractionCheck} />}
          {currentPage === 'sell' && (
            <SellPage
              medicineDB={medicineDB}
              onNavigate={setCurrentPage}
              showNotification={showNotification}
              onOpenReceiptModal={(data) => { setReceiptData(data); setOpenModal('receipt'); }}
              onSaleComplete={handleSaleComplete}
              preloadItem={preloadSellItem}
              onPreloadConsumed={() => setPreloadSellItem(null)}
            />
          )}
          {currentPage === 'suppliers' && (
            <SuppliersPage
              onOpenModal={(modal, supplierName) => {
                setReorderSupplier(supplierName || '');
                setOpenModal(modal);
              }}
              showNotification={showNotification}
              currentUser={currentUser}
            />
          )}
          {currentPage === 'reports' && (
            <ReportsPage
              inventoryData={inventoryData}
              showNotification={showNotification}
            />
          )}
          {currentPage === 'settings' && (
            <SettingsPage
              user={currentUser}
              onLogout={handleLogout}
              showNotification={showNotification}
              darkMode={darkMode}
              onToggleDark={toggleDarkMode}
            />
          )}
          {currentPage === 'notifications' && (
            <NotificationsPage
              notifications={appNotif.notifications}
              onMarkRead={appNotif.markRead}
              onMarkAllRead={() => { appNotif.markAllRead(); showNotification('All notifications marked as read.'); }}
              onNavigate={setCurrentPage}
            />
          )}
        </main>
      </div>

      {/* Pharmacy Network Alert Panel */}
      <NetworkAlertPanel
        networkAlerts={networkAlerts}
        hasNew={hasNew}
        onDismiss={dismissAlert}
        onDismissAll={dismissAll}
        onMarkSeen={markSeen}
      />

      {/* Modals */}
      <AddMedicationModal
        isOpen={openModal === 'add'}
        onClose={() => setOpenModal(null)}
        onAdd={handleAddMedication}
        medicineDB={medicineDB}
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
