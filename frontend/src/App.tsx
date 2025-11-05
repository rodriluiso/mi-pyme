import { RouterProvider } from 'react-router-dom';
import AppProviders from '@/providers/AppProviders';
import { router } from '@/routes';

const App = () => {
  return (
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  );
};

export default App;
