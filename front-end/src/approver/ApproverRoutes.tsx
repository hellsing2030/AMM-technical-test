import { useLocation } from "react-router-dom";
import { ApprovalPage } from "./pages/ApprovalPage";
import { ApproverDashboardPage } from "./pages/ApproverDashboardPage";

export default function ApproverRoutes() {
  const location = useLocation();
  return location.pathname.startsWith("/approve") ? <ApprovalPage /> : <ApproverDashboardPage />;
}
