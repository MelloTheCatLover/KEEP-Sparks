import { createBrowserRouter } from "react-router-dom";
import { LoginPage } from "../features/auth/LoginPage";
import { HomePage } from "../features/dashboard/HomePage";
import { AdminLayout } from "../features/admin/AdminLayout";
import { AdminHubPage } from "../features/admin/AdminHubPage";
import { AdminRankingPanel } from "../features/sparks/AdminRankingPanel";
import { OverallRatingPage } from "../features/sparks/OverallRatingPage";
import { PeopleOfDayPage } from "../features/sparks/PeopleOfDayPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { ChildrenPage } from "../features/children/ChildrenPage";
import { ShiftsPage } from "../features/shifts/ShiftsPage";
import { ShiftDetailPage } from "../features/shifts/ShiftDetailPage";
import { PeopleOfShiftPage } from "../features/shifts/PeopleOfShiftPage";
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
              { index: true, element: <AdminHubPage /> },
              { path: "ranking", element: <AdminRankingPanel /> },
              { path: "overview", element: <OverallRatingPage /> },
              { path: "people-of-day", element: <PeopleOfDayPage /> },
              { path: "people-of-shift", element: <PeopleOfShiftPage /> },
              { path: "children", element: <ChildrenPage /> },
              { path: "shifts", element: <ShiftsPage /> },
              { path: "shifts/:id", element: <ShiftDetailPage /> },
              { path: "settings", element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
