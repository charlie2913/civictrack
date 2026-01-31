import { BrowserRouter, Route, Routes } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";
import Home from "../pages/Home";
import MapPublic from "../pages/MapPublic";
import NotFound from "../pages/NotFound";
import Login from "../pages/Login";
import Unauthorized from "../pages/Unauthorized";
import AdminInbox from "../pages/AdminInbox";
import AdminReportDetail from "../pages/AdminReportDetail";
import NewReport from "../pages/NewReport";
import ReportCreated from "../pages/ReportCreated";
import TrackReport from "../pages/TrackReport";
import ReportDetail from "../pages/ReportDetail";
import MyReports from "../pages/MyReports";
import ProtectedRoute from "./ProtectedRoute";
import RoleRoute from "./RoleRoute";

const AppRouter = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<PublicLayout />}>
          <Route path="/" element={<Home />} />
          <Route path="/map" element={<MapPublic />} />
          <Route path="/report/new" element={<NewReport />} />
          <Route path="/report/created/:id" element={<ReportCreated />} />
          <Route path="/track" element={<TrackReport />} />
          <Route path="/reports/:id" element={<ReportDetail />} />
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route element={<ProtectedRoute />}>
            <Route path="/my-reports" element={<MyReports />} />
            <Route element={<RoleRoute roles={["ADMIN", "OPERATOR", "SUPERVISOR"]} />}>
              <Route path="/admin" element={<AdminInbox />} />
              <Route path="/admin/reports/:id" element={<AdminReportDetail />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
