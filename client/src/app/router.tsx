import { Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { AppShell } from '../components/layout/AppShell';
import { useAuth } from '../features/auth/AuthContext';
import { LoginPage } from '../features/auth/LoginPage';
import { BatchDetailPage } from '../features/batches/BatchDetailPage';
import { BatchesPage } from '../features/batches/BatchesPage';
import { CreateBatchPage } from '../features/batches/CreateBatchPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { BetPage, SterilityPage } from '../features/lab/LabTestPages';
import { LabellingPage } from '../features/labelling/LabellingPage';
import { InventoryPage } from '../features/inventory/InventoryPage';
import { PackingPage } from '../features/packing/PackingPage';
import { SealingPage } from '../features/packing/SealingPage';
import { ManufacturingPage } from '../features/production/ManufacturingPage';
import { RawMaterialPage } from '../features/production/RawMaterialPage';
import { ProductsPage } from '../features/products/ProductsPage';
import { InProcessQcPage } from '../features/qc/InProcessQcPage';
import { VisualInspectionPage } from '../features/qc/VisualInspectionPage';
import { FinishedGoodsPage } from '../features/qa/FinishedGoodsPage';
import { QaReviewPage } from '../features/qa/QaReviewPage';
import { BatchDispatchPage, DispatchesPage } from '../features/dispatch/DispatchesPage';
import { CustomersPage } from '../features/dispatch/CustomersPage';
import { EtoCartridgesPage } from '../features/sterilization/EtoCartridgesPage';
import { SterilizationPage } from '../features/sterilization/SterilizationPage';
import { AuditLogsPage, BatchAuditPage } from '../features/audit/AuditLogsPage';
import { ReportsPage } from '../features/reports/ReportsPage';
import { SopsPage } from '../features/sops/SopsPage';
import { UsersPage } from '../features/users/UsersPage';
import { NotificationsPage } from '../features/notifications/NotificationsPage';
import { SettingsPage } from '../features/settings/SettingsPage';

function ProtectedRoute() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted">
        Loading…
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

export function AppRouter() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppShell />}>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/inbox" element={<NotificationsPage />} />
          <Route path="/batches" element={<BatchesPage />} />
          <Route path="/batches/create" element={<CreateBatchPage />} />
          <Route path="/batches/:batchId" element={<BatchDetailPage />} />
          <Route path="/batches/:batchId/raw-material" element={<RawMaterialPage />} />
          <Route path="/batches/:batchId/manufacturing" element={<ManufacturingPage />} />
          <Route path="/batches/:batchId/qc" element={<InProcessQcPage />} />
          <Route path="/batches/:batchId/inspection" element={<VisualInspectionPage />} />
          <Route path="/batches/:batchId/packing" element={<PackingPage />} />
          <Route path="/batches/:batchId/sealing" element={<SealingPage />} />
          <Route path="/batches/:batchId/sterilization" element={<SterilizationPage />} />
          <Route path="/batches/:batchId/labelling" element={<LabellingPage />} />
          <Route path="/batches/:batchId/sterility" element={<SterilityPage />} />
          <Route path="/batches/:batchId/bet" element={<BetPage />} />
          <Route path="/batches/:batchId/qa" element={<QaReviewPage />} />
          <Route path="/batches/:batchId/finished-goods" element={<FinishedGoodsPage />} />
          <Route path="/batches/:batchId/dispatch" element={<BatchDispatchPage />} />
          <Route path="/batches/:batchId/audit" element={<BatchAuditPage />} />
          <Route path="/products" element={<ProductsPage />} />
          <Route path="/eto-cartridges" element={<EtoCartridgesPage />} />
          <Route path="/inventory" element={<InventoryPage />} />
          <Route path="/customers" element={<CustomersPage />} />
          <Route path="/dispatches" element={<DispatchesPage />} />
          <Route path="/sops" element={<SopsPage />} />
          <Route path="/users" element={<UsersPage />} />
          <Route path="/reports" element={<ReportsPage />} />
          <Route path="/audit-logs" element={<AuditLogsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
