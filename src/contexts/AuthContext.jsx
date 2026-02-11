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
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        const userRef = doc(db, 'users', firebaseUser.uid)
        const userSnap = await getDoc(userRef)

        // Check if there's a referral in the URL
        const params = new URLSearchParams(window.location.search)
        const referrer = params.get('ref')

        if (!userSnap.exists()) {
          // Check if this is the very first user (auto-approve the founder)
          const usersSnap = await getDocs(query(collection(db, 'users'), limit(1)))
          const isFirstUser = usersSnap.empty

          const isApproved = isFirstUser || !!referrer
          await setDoc(userRef, {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
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

          // Clean up the URL param
          if (referrer) {
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
            window.history.replaceState({}, '', window.location.pathname)
          } else {
            setApproved(data.approved === true)
          }

          if (!data.displayNameLower) {
            const name = data.displayName || firebaseUser.email.split('@')[0]
            await updateDoc(userRef, { displayNameLower: name.toLowerCase() })
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
