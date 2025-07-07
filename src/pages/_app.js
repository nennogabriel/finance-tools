import { Toaster } from 'react-hot-toast';
import Header from '@/components/Header';
import '@/styles/globals.css';

function MyApp({ Component, pageProps }) {
  return (
    <>
      <Toaster 
        position="top-right"
        toastOptions={{
          className: '',
          duration: 5000,
          style: {
            background: '#ffffff',
            color: '#363636',
            border: '1px solid #e0e0e0',
            boxShadow: '0 2px 10px rgba(0, 0, 0, 0.1)',
          },
          // Overrides for specific types
          error: {
            style: {
              background: '#fde8e8',
              color: '#c53030',
              border: '1px solid #fbcaca',
            },
          },
        }}
      />
      <Header />
      <Component {...pageProps} />
    </>
  );
}

export default MyApp;
