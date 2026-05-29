import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import { AuthProvider } from '@/contexts/AuthContext'
import { ThemeProvider } from '@/contexts/ThemeContext'
import { initSentry, SentryErrorBoundary } from '@/lib/sentry'
import './index.css'
import 'leaflet/dist/leaflet.css'

initSentry()

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: 1
    }
  }
})

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <SentryErrorBoundary
      fallback={
        <div className="flex h-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
          Une erreur est survenue. Recharge la page.
        </div>
      }
    >
      <BrowserRouter>
        <QueryClientProvider client={queryClient}>
          <ThemeProvider>
            <AuthProvider>
              <App />
              <Toaster
                position="top-center"
                toastOptions={{
                  duration: 3000,
                  style: {
                    background: 'hsl(var(--popover))',
                    color: 'hsl(var(--popover-foreground))',
                    border: '1px solid hsl(var(--border))',
                    borderRadius: '0.75rem',
                    fontSize: '0.875rem',
                    padding: '0.625rem 0.875rem',
                    boxShadow: '0 10px 25px -10px rgba(0,0,0,0.15)'
                  },
                  success: { iconTheme: { primary: 'hsl(var(--primary))', secondary: 'white' } },
                  error: { iconTheme: { primary: 'hsl(var(--destructive))', secondary: 'white' } }
                }}
              />
            </AuthProvider>
          </ThemeProvider>
        </QueryClientProvider>
      </BrowserRouter>
    </SentryErrorBoundary>
  </React.StrictMode>
)
