import { createBrowserRouter, Navigate } from "react-router-dom";
import { LoginPage } from "../features/auth/LoginPage";
import { ChildLayout } from "../features/child/ChildLayout";
import { ChildHomePage } from "../features/child/ChildHomePage";
import { SparksBoardPage } from "../features/child/SparksBoardPage";
import { ChildWinnersPage } from "../features/child/ChildWinnersPage";
import { ChildPeopleOfShiftPage } from "../features/child/ChildPeopleOfShiftPage";
import { ChildPeopleOfDayPage } from "../features/child/ChildPeopleOfDayPage";
import { AdminLayout } from "../features/admin/AdminLayout";
import { AdminRankingPanel } from "../features/sparks/AdminRankingPanel";
import { OverallRatingPage } from "../features/sparks/OverallRatingPage";
import { LookupPage } from "../features/sparks/LookupPage";
import { ShiftPeopleOfDayPage } from "../features/shifts/ShiftPeopleOfDayPage";
import { SettingsPage } from "../features/settings/SettingsPage";
import { ChildrenPage } from "../features/children/ChildrenPage";
import { ChildDashboardPage } from "../features/dashboard/ChildDashboardPage";
import { ShiftsPage } from "../features/shifts/ShiftsPage";
import { ShiftDetailPage } from "../features/shifts/ShiftDetailPage";
import { ShiftEditPage } from "../features/shifts/ShiftEditPage";
import { WinnersPage } from "../features/shifts/WinnersPage";
import { ContestsPage } from "../features/shifts/ContestsPage";
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
      {
        element: <ChildLayout />,
        children: [
          { path: "/", element: <ChildHomePage /> },
          { path: "/board", element: <SparksBoardPage /> },
          { path: "/winners", element: <ChildWinnersPage /> },
          { path: "/people-of-shift", element: <ChildPeopleOfShiftPage /> },
          { path: "/people-of-day", element: <ChildPeopleOfDayPage /> },
        ],
      },
      {
        element: <AdminRoute />,
        children: [
          {
            path: "/admin",
            element: <AdminLayout />,
            children: [
              { index: true, element: <Navigate to="ranking" replace /> },
              { path: "ranking", element: <AdminRankingPanel /> },
              { path: "overview", element: <OverallRatingPage /> },
              { path: "lookup", element: <LookupPage /> },
              { path: "people-of-day", element: <ShiftPeopleOfDayPage /> },
              { path: "people-of-shift", element: <PeopleOfShiftPage /> },
              { path: "children", element: <ChildrenPage /> },
              { path: "children/:id", element: <ChildDashboardPage /> },
              { path: "shifts", element: <ShiftsPage /> },
              { path: "winners", element: <WinnersPage /> },
              { path: "contests", element: <ContestsPage /> },
              { path: "shifts/:id", element: <ShiftDetailPage /> },
              { path: "shifts/:id/edit", element: <ShiftEditPage /> },
              { path: "settings", element: <SettingsPage /> },
            ],
          },
        ],
      },
    ],
  },
]);
