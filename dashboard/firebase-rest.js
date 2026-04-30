/**
 * Firebase Auth REST API Client for Chrome Extensions
 * Implements Firebase Authentication using REST API (no SDK, no eval required)
 */

// Load config from config.js - use internal variable to avoid conflict
let __CONFIG = null;

async function loadConfig() {
  if (__CONFIG) return __CONFIG;
  
  // First check if already loaded globally
  if (typeof window !== 'undefined' && window.CONFIG) {
    __CONFIG = window.CONFIG;
    return __CONFIG;
  }
  
  // Try to import config.js
  try {
    const configModule = await import(chrome.runtime.getURL('config.js'));
    __CONFIG = configModule.default || configModule.CONFIG || window.CONFIG;
  } catch (e) {
    console.error('Failed to load config.js:', e);
    throw new Error('config.js not found. Please ensure config.js exists in extension root.');
  }
  
  return __CONFIG;
}

// Global firebase object to maintain compatibility with dashboard.js
window.firebase = {
  auth: function() {
    return FirebaseAuthRest;
  }
};

const FirebaseAuthRest = {
  currentUser: null,
  _authStateCallbacks: [],

  // Sign in with email/password
  signInWithEmailAndPassword: async function(email, password) {
    await loadConfig();
    const url = `${__CONFIG.AUTH_BASE_URL}/accounts:signInWithPassword?key=${__CONFIG.FIREBASE_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: password,
        returnSecureToken: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error?.message || 'Authentication failed');
      error.code = this._mapErrorCode(data.error?.message);
      throw error;
    }

    const user = this._createUser(data);
    this.currentUser = user;
    this._notifyAuthStateChanged(user);
    
    return { user: user };
  },

  // Create user with email/password
  createUserWithEmailAndPassword: async function(email, password) {
    await loadConfig();
    const url = `${__CONFIG.AUTH_BASE_URL}/accounts:signUp?key=${__CONFIG.FIREBASE_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: email,
        password: password,
        returnSecureToken: true
      })
    });

    const data = await response.json();

    if (!response.ok) {
      const error = new Error(data.error?.message || 'Account creation failed');
      error.code = this._mapErrorCode(data.error?.message);
      throw error;
    }

    const user = this._createUser(data);
    this.currentUser = user;
    this._notifyAuthStateChanged(user);
    
    return { user: user };
  },

  // Sign out
  signOut: async function() {
    this.currentUser = null;
    this._notifyAuthStateChanged(null);
    return Promise.resolve();
  },

  // Get current user
  getCurrentUser: function() {
    return this.currentUser;
  },

  // Auth state listener
  onAuthStateChanged: function(callback) {
    this._authStateCallbacks.push(callback);
    // Immediately call with current state
    callback(this.currentUser);
    
    // Return unsubscribe function
    return () => {
      const index = this._authStateCallbacks.indexOf(callback);
      if (index > -1) {
        this._authStateCallbacks.splice(index, 1);
      }
    };
  },

  // Refresh token
  refreshToken: async function(refreshToken) {
    await loadConfig();
    const url = `${__CONFIG.TOKEN_URL}/token?key=${__CONFIG.FIREBASE_API_KEY}`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: `grant_type=refresh_token&refresh_token=${encodeURIComponent(refreshToken)}`
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error?.message || 'Token refresh failed');
    }

    return {
      idToken: data.id_token,
      refreshToken: data.refresh_token,
      expiresIn: data.expires_in
    };
  },

  // Notify all listeners
  _notifyAuthStateChanged: function(user) {
    this._authStateCallbacks.forEach(callback => {
      try {
        callback(user);
      } catch (e) {
        console.error('Auth state callback error:', e);
      }
    });
  },

  // Create user object from API response
  _createUser: function(data) {
    const user = {
      uid: data.localId,
      email: data.email,
      displayName: data.displayName || null,
      emailVerified: data.emailVerified || false,
      idToken: data.idToken,
      refreshToken: data.refreshToken,
      expiresIn: data.expiresIn,
      // Token expiration time
      tokenExpiry: Date.now() + (parseInt(data.expiresIn) * 1000),
      
      // Method to get ID token
      getIdToken: async function(forceRefresh) {
        // Check if token needs refresh (expires in less than 5 minutes)
        const needsRefresh = forceRefresh || 
          (this.tokenExpiry - Date.now() < 5 * 60 * 1000);
        
        if (needsRefresh && this.refreshToken) {
          const refreshed = await FirebaseAuthRest.refreshToken(this.refreshToken);
          this.idToken = refreshed.idToken;
          this.refreshToken = refreshed.refreshToken;
          this.expiresIn = refreshed.expiresIn;
          this.tokenExpiry = Date.now() + (parseInt(refreshed.expiresIn) * 1000);
        }
        
        return this.idToken;
      }
    };
    
    return user;
  },

  // Map Firebase error messages to error codes
  _mapErrorCode: function(errorMessage) {
    if (!errorMessage) return 'auth/unknown';
    
    if (errorMessage.includes('EMAIL_NOT_FOUND')) return 'auth/user-not-found';
    if (errorMessage.includes('INVALID_PASSWORD')) return 'auth/wrong-password';
    if (errorMessage.includes('INVALID_EMAIL')) return 'auth/invalid-email';
    if (errorMessage.includes('EMAIL_EXISTS')) return 'auth/email-already-in-use';
    if (errorMessage.includes('WEAK_PASSWORD')) return 'auth/weak-password';
    if (errorMessage.includes('INVALID_LOGIN_CREDENTIALS')) return 'auth/invalid-credential';
    if (errorMessage.includes('USER_DISABLED')) return 'auth/user-disabled';
    
    return 'auth/unknown';
  }
};

// Restore session from storage on load
(async function restoreSession() {
  try {
    const data = await chrome.storage.local.get(['firebaseUID', 'firebaseToken', 'firebaseRefreshToken', 'firebaseEmail']);
    
    if (data.firebaseUID && data.firebaseToken) {
      // Create a user object from stored data
      const user = {
        uid: data.firebaseUID,
        email: data.firebaseEmail || '',
        idToken: data.firebaseToken,
        refreshToken: data.firebaseRefreshToken,
        expiresIn: '3600',
        tokenExpiry: Date.now() + 3600 * 1000,
        
        getIdToken: async function(forceRefresh) {
          if (forceRefresh && this.refreshToken) {
            const refreshed = await FirebaseAuthRest.refreshToken(this.refreshToken);
            this.idToken = refreshed.idToken;
            this.refreshToken = refreshed.refreshToken;
            this.expiresIn = refreshed.expiresIn;
            this.tokenExpiry = Date.now() + (parseInt(refreshed.expiresIn) * 1000);
            
            // Update storage
            await chrome.storage.local.set({
              firebaseToken: this.idToken,
              firebaseRefreshToken: this.refreshToken
            });
          }
          return this.idToken;
        }
      };
      
      FirebaseAuthRest.currentUser = user;
      console.log('🔥 Firebase session restored for UID:', user.uid);
    }
  } catch (error) {
    console.error('Session restore error:', error);
  }
})();

console.log('🔥 Firebase REST API client loaded');
