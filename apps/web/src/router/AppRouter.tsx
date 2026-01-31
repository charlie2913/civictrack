import { BrowserRouter, Route, Routes } from "react-router-dom";
import PublicLayout from "../components/layout/PublicLayout";
import Home from "../pages/Home";
import MapPublic from "../pages/MapPublic";
import NotFound from "../pages/NotFound";
import Login from "../pages/Login";
import Unauthorized from "../pages/Unauthorized";
import Admin from "../pages/Admin";
import NewReport from "../pages/NewReport";
import ReportCreated from "../pages/ReportCreated";
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
          <Route path="/login" element={<Login />} />
          <Route path="/unauthorized" element={<Unauthorized />} />
          <Route element={<ProtectedRoute />}>
            <Route element={<RoleRoute roles={["ADMIN"]} />}>
              <Route path="/admin" element={<Admin />} />
            </Route>
          </Route>
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
};

export default AppRouter;
