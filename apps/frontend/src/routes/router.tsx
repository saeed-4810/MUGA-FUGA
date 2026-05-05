import { createBrowserRouter } from "react-router-dom";

import { AppShell } from "../components/AppShell";
import { AdminQueuePage } from "../pages/AdminQueuePage";
import { CreateProductPage } from "../pages/CreateProductPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProductsPage } from "../pages/ProductsPage";
import { ArtistsPage } from "../pages/admin/ArtistsPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "login", element: <LoginPage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "products/new", element: <CreateProductPage /> },
      { path: "admin/artists", element: <ArtistsPage /> },
      { path: "admin/queue", element: <AdminQueuePage /> },
    ],
  },
]);
