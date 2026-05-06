import { createBrowserRouter } from "react-router-dom";

import { AppShell, AuthLayout } from "../components/AppShell";
import { AdminQueuePage } from "../pages/AdminQueuePage";
import { CreateProductPage } from "../pages/CreateProductPage";
import { DashboardPage } from "../pages/DashboardPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { ProductsPage } from "../pages/ProductsPage";
import { ArtistsPage } from "../pages/admin/ArtistsPage";

/*
 * Two parallel layout branches:
 *  - `AuthLayout` mounts ONLY the providers + an `<Outlet>` (no Sidebar, no TopBar).
 *    Any pre-auth route lives here. The login overlay is therefore a JS-level
 *    isolation: the chrome components are never imported into the React tree
 *    on /login, regardless of CSS / viewport size.
 *  - `AppShell` mounts the providers AND the post-auth chrome. Any protected
 *    route (already gated client-side via `RequireAuth`) lives here.
 */
export const router = createBrowserRouter([
  {
    path: "/login",
    element: <AuthLayout />,
    errorElement: <NotFoundPage />,
    children: [{ index: true, element: <LoginPage /> }],
  },
  {
    path: "/",
    element: <AppShell />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <DashboardPage /> },
      { path: "products", element: <ProductsPage /> },
      { path: "products/new", element: <CreateProductPage /> },
      { path: "admin/artists", element: <ArtistsPage /> },
      { path: "admin/queue", element: <AdminQueuePage /> },
    ],
  },
]);
