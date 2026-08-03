import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { Festive } from "./shared/ui/Festive";
import { MaintenanceGate } from "./shared/ui/MaintenanceGate";
import { router } from "./app/router";

function App() {
  return (
    <AuthProvider>
      <Festive />
      <MaintenanceGate>
        <RouterProvider router={router} />
      </MaintenanceGate>
    </AuthProvider>
  );
}

export default App;
