import { Route, Routes, useLocation } from "react-router-dom";
import { CreateRequestPage } from "./pages/CreateRequestPage";
import { MockMailPage } from "./pages/MockMailPage";
import { RequestDetailPage } from "./pages/RequestDetailPage";
import { RequestListPage } from "./pages/RequestListPage";

export default function RequesterRoutes() {
  const location = useLocation();
  if (location.pathname === "/mock-mail") return <MockMailPage />;

  return (
    <Routes>
      <Route index element={<RequestListPage />} />
      <Route path="new" element={<CreateRequestPage />} />
      <Route path=":requestId" element={<RequestDetailPage />} />
    </Routes>
  );
}
