import { RouterProvider } from "react-router-dom";
import { AuthProvider } from "./features/auth/AuthContext";
import { Festive } from "./shared/ui/Festive";
import { router } from "./app/router";

function App() {
  return (
    <AuthProvider>
      <Festive />
      <RouterProvider router={router} />
    </AuthProvider>
  );
}

export default App;
