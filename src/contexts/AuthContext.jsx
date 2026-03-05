import { createContext, useContext, useState, useEffect } from 'react'
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  updateProfile
} from 'firebase/auth'
import { doc, setDoc, getDoc, getDocs, updateDoc, serverTimestamp, collection, query, limit } from 'firebase/firestore'
import { auth, db } from '../services/firebase'
import { followUser, addToTrusti9 } from '../services/firestore'

const AuthContext = createContext(null)

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null)
  const [approved, setApproved] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (window.location.hostname === 'localhost') {
      setUser({ uid: 'test-user', email: 'test@test.com' })
      setApproved(true)
      setLoading(false)
      return
    }

    // Capture referral param NOW, before ProtectedRoute can redirect and drop it from the URL.
    // Also persist to localStorage so it survives page reloads and tab closures.
    const urlParams = new URLSearchParams(window.location.search)
    const urlRef = urlParams.get('ref')
    if (urlRef) localStorage.setItem('trusti_pending_ref', urlRef)

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid)
        const userSnap = await getDoc(userRef)

        // Use the param captured at mount time, or the localStorage backup
        const referrer = urlRef || localStorage.getItem('trusti_pending_ref')

        if (!userSnap.exists()) {
          // Check if this is the very first user (auto-approve the founder)
          const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)))
          const isFirstUser = usersSnap.empty

          const isApproved = isFirstUser || !!referrer
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            emailLower: firebaseUser.email.toLowerCase(),
            displayName: firebaseUser.displayName || firebaseUser.email.split('@')[0],
            displayNameLower: (firebaseUser.displayName || firebaseUser.email.split('@')[0]).toLowerCase(),
            photoURL: firebaseUser.photoURL || null,
            location: { type: 'manual', lat: null, lng: null, zipCode: null, neighborhood: null },
            followersCount: 0,
            followingCount: 0,
            approved: isApproved,
            invitedBy: referrer || null,
            createdAt: serverTimestamp()
          })
          setApproved(isApproved)

          // Auto-follow: inviter and invitee become friends
          if (referrer) {
            try {
              await followUser(firebaseUser.uid, referrer) // new user follows inviter
              await followUser(referrer, firebaseUser.uid) // inviter follows new user
              await addToTrusti9(firebaseUser.uid, referrer) // add inviter to new user's trusti 9
            } catch (err) {
              console.error('Auto-follow failed:', err)
            }
            localStorage.removeItem('trusti_pending_ref')
            window.history.replaceState({}, '', window.location.pathname)
          }
        } else {
          // Existing user
          const data = userSnap.data()

          if (data.approved === undefined) {
            // Pre-existing user before invite system — auto-approve
            await updateDoc(userRef, { approved: true })
            setApproved(true)
          } else if (!data.approved && referrer) {
            // Got invited now — upgrade
            await updateDoc(userRef, { approved: true, invitedBy: referrer })
            setApproved(true)
            // Auto-follow: inviter and invitee become friends
            try {
              await followUser(firebaseUser.uid, referrer)
              await followUser(referrer, firebaseUser.uid)
              await addToTrusti9(firebaseUser.uid, referrer) // add inviter to trusti 9
            } catch (err) {
              console.error('Auto-follow failed:', err)
            }
            localStorage.removeItem('trusti_pending_ref')
            window.history.replaceState({}, '', window.location.pathname)
          } else {
            setApproved(data.approved === true)
          }

          // Backfill searchable fields for existing accounts
          const backfill = {}
          if (!data.displayNameLower) {
            backfill.displayNameLower = (data.displayName || firebaseUser.email.split('@')[0]).toLowerCase()
          }
          if (!data.emailLower) {
            backfill.emailLower = firebaseUser.email.toLowerCase()
          }
          if (Object.keys(backfill).length > 0) {
            await updateDoc(userRef, backfill)
          }
        }
        setUser(firebaseUser)
      } else {
        setUser(null)
        setApproved(false)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  async function signup(email, password, displayName) {
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName })
    return cred.user
  }

  async function login(email, password) {
    return signInWithEmailAndPassword(auth, email, password)
  }

  async function loginWithGoogle() {
    const provider = new GoogleAuthProvider()
    return signInWithPopup(auth, provider)
  }

  async function logout() {
    return signOut(auth)
  }

  const value = { user, approved, loading, signup, login, loginWithGoogle, logout }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}
