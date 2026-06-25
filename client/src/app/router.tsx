import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "../features/auth/LoginPage";
import { HomePage } from "../features/dashboard/HomePage";
import { AdminLayout } from "../features/admin/AdminLayout";
import { AdminRankingPanel } from "../features/sparks/AdminRankingPanel";
import { SettingsPage } from "../features/settings/SettingsPage";
import {
  AdminRoute,
  GuestRoute,
  ProtectedRoute,
} from "../shared/ui/route-guards";

export const router = createBrowserRouter([
  {
    element: <GuestRoute />,
    children: [{ path: "/login", element: <LoginPage /> }],
  },
  {
    element: <ProtectedRoute />,
    children: [
      { path: "/", element: <HomePage /> },
      {
        element: <AdminRoute />,
        children: [
          {
            path: "/admin",
            element: <AdminLayout />,
            children: [
              { index: true, element: <AdminRankingPanel /> },
              { path: "settings", element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
