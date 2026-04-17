/**
 * preload.js — Runs in the renderer process context with Node.js access.
 * Exposes a safe, typed API surface to the renderer page via contextBridge.
 */
const { contextBridge, ipcRenderer } = require('electron')
const { createClient } = require('@supabase/supabase-js')

// ── Supabase client (auth only — session stored in localStorage) ──────────
const SUPABASE_URL = 'https://qitksugdxvkuesclyyuk.supabase.co'
const SUPABASE_ANON_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFpdGtzdWdkeHZrdWVzY2x5eXVrIiwicm9sZSI6ImF' +
  'ub24iLCJpYXQiOjE3NzM5NjMxMDcsImV4cCI6MjA4OTUzOTEwN30.' +
  'LW5TTeziPouLWTwJZbpXtXTIw9C1k_IuocGEdrzOMMs'

// localStorage is available in preload (renderer window context).
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: window.localStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
})

// Retrieve the current access token (auto-refreshes if expired).
async function getToken() {
  try {
    await supabase.auth.getUser() // forces a refresh if needed
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token ?? null
  } catch {
    return null
  }
}

// ── Exposed API ───────────────────────────────────────────────────────────
contextBridge.exposeInMainWorld('api', {
  // ── Auth ─────────────────────────────────────────────────────────────────
  auth: {
    signIn: async (email, password) => {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) return { ok: false, error: error.message }
      return {
        ok: true,
        user: {
          id: data.user.id,
          email: data.user.email,
          name:
            data.user.user_metadata?.full_name ??
            data.user.user_metadata?.name ??
            data.user.email,
        },
      }
    },

    signOut: async () => {
      await supabase.auth.signOut()
      return { ok: true }
    },

    getSession: async () => {
      const { data } = await supabase.auth.getSession()
      if (!data.session) return { session: null }
      return {
        session: {
          access_token: data.session.access_token,
          user: {
            id: data.session.user.id,
            email: data.session.user.email,
            name:
              data.session.user.user_metadata?.full_name ??
              data.session.user.user_metadata?.name ??
              data.session.user.email,
          },
        },
      }
    },
  },

  // ── Native desktop capabilities ────────────────────────────────────────
  desktop: {
    getDesktopSources: () => ipcRenderer.invoke('get-desktop-sources'),
    requestMediaAccess: (type) => ipcRenderer.invoke('request-media-access', type),
    getMediaAccessStatus: (type) => ipcRenderer.invoke('get-media-access-status', type),
    openExternal: (url) => ipcRenderer.invoke('open-external', url),
  },

  // ── Transcript AI API (all calls proxied via main to avoid CORS) ──────────
  transcript: {
    /** List clients accessible to the current user */
    listClients: async () => {
      const token = await getToken()
      if (!token) return { ok: false, error: 'Not authenticated', data: {} }
      return ipcRenderer.invoke('transcript-api', {
        apiPath: '/api/clinical/clients',
        method: 'GET',
        body: null,
        token,
      })
    },

    /** Create a new recording session */
    createSession: async ({ client_id, title, started_at }) => {
      const token = await getToken()
      if (!token) return { ok: false, error: 'Not authenticated', data: {} }
      return ipcRenderer.invoke('transcript-api', {
        apiPath: '/api/clinical/sessions',
        method: 'POST',
        body: { client_id, title, started_at },
        token,
      })
    },

    /**
     * Signal the end of a recording — returns a signed Supabase upload URL.
     * Response: { audio_file_id, upload: { signedUrl, token, path } }
     */
    stopRecording: async ({ session_id, client_id, mime_type, size_bytes, stopped_at }) => {
      const token = await getToken()
      if (!token) return { ok: false, error: 'Not authenticated', data: {} }
      return ipcRenderer.invoke('transcript-api', {
        apiPath: '/api/clinical/recordings/stop',
        method: 'POST',
        body: { session_id, client_id, mime_type, size_bytes, stopped_at },
        token,
      })
    },

    /** Confirm upload complete — triggers transcription job */
    completeUpload: async ({ audio_file_id, session_id }) => {
      const token = await getToken()
      if (!token) return { ok: false, error: 'Not authenticated', data: {} }
      return ipcRenderer.invoke('transcript-api', {
        apiPath: '/api/clinical/recordings/upload-complete',
        method: 'POST',
        body: { audio_file_id, session_id },
        token,
      })
    },
  },

  /** Upload audio bytes to the pre-signed Supabase storage URL */
  uploadAudio: async ({ signedUrl, arrayBuffer, contentType }) => {
    return ipcRenderer.invoke('upload-audio', {
      signedUrl,
      buffer: arrayBuffer,
      contentType,
    })
  },
})
