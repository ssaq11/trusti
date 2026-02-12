import {
  collection, doc, setDoc, getDoc, getDocs, addDoc, deleteDoc,
  query, where, orderBy, limit, serverTimestamp, updateDoc, increment
} from 'firebase/firestore'
import { db } from './firebase'

// --- USERS ---

export async function getUserProfile(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { id: snap.id, ...snap.data() } : null
}

export async function updateUserLocation(uid, locationData) {
  await updateDoc(doc(db, 'users', uid), { location: locationData })
}

export async function searchUsers(searchText) {
  if (!searchText || searchText.length < 2) return []
  const lower = searchText.toLowerCase()
  const q = query(
    collection(db, 'users'),
    where('displayNameLower', '>=', lower),
    where('displayNameLower', '<=', lower + '\uf8ff'),
    limit(20)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// --- RECOMMENDATIONS ---

export async function addRecommendation(data) {
  return addDoc(collection(db, 'recommendations'), {
    ...data,
    createdAt: serverTimestamp()
  })
}

export async function getUserRecommendations(uid) {
  // Simple equality query — no composite index needed
  const q = query(
    collection(db, 'recommendations'),
    where('userId', '==', uid)
  )
  const snap = await getDocs(q)
  const results = snap.docs.map(d => ({ id: d.id, ...d.data() }))
  // Sort client-side
  return results.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

export async function getFeedRecommendations(followingIds, zipCode = null) {
  if (followingIds.length === 0) return []

  const allResults = []
  for (let i = 0; i < followingIds.length; i += 30) {
    const batch = followingIds.slice(i, i + 30)
    // Only use 'in' filter — no orderBy to avoid composite index requirement
    const q = query(
      collection(db, 'recommendations'),
      where('userId', 'in', batch)
    )
    const snap = await getDocs(q)
    allResults.push(...snap.docs.map(d => ({ id: d.id, ...d.data() })))
  }

  // Filter by zip client-side if provided
  let filtered = allResults
  if (zipCode) {
    filtered = allResults.filter(r => r.zipCode === zipCode)
  }

  // Sort client-side by createdAt desc
  return filtered.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
}

export async function getDiscoverRecommendations() {
  const q = query(
    collection(db, 'recommendations'),
    orderBy('createdAt', 'desc'),
    limit(50)
  )
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

export async function deleteRecommendation(recId) {
  await deleteDoc(doc(db, 'recommendations', recId))
}

export async function updateRecommendation(recId, data) {
  await updateDoc(doc(db, 'recommendations', recId), data)
}

// --- FOLLOWS ---

export async function followUser(followerId, followingId) {
  const docId = `${followerId}_${followingId}`
  await setDoc(doc(db, 'follows', docId), {
    followerId,
    followingId,
    createdAt: serverTimestamp()
  })
  await updateDoc(doc(db, 'users', followerId), { followingCount: increment(1) })
  await updateDoc(doc(db, 'users', followingId), { followersCount: increment(1) })
}

export async function unfollowUser(followerId, followingId) {
  const docId = `${followerId}_${followingId}`
  await deleteDoc(doc(db, 'follows', docId))
  await updateDoc(doc(db, 'users', followerId), { followingCount: increment(-1) })
  await updateDoc(doc(db, 'users', followingId), { followersCount: increment(-1) })
}

export async function getFollowingIds(uid) {
  const q = query(collection(db, 'follows'), where('followerId', '==', uid))
  const snap = await getDocs(q)
  return snap.docs.map(d => d.data().followingId)
}

export async function getFollowingProfiles(uid) {
  const ids = await getFollowingIds(uid)
  if (ids.length === 0) return []
  const profiles = await Promise.all(
    ids.map(id => getUserProfile(id))
  )
  return profiles.filter(Boolean)
}

export async function isFollowing(followerId, followingId) {
  const docId = `${followerId}_${followingId}`
  const snap = await getDoc(doc(db, 'follows', docId))
  return snap.exists()
}

// --- BOOKMARKS (Want to go) ---

export async function addBookmark(userId, placeData) {
  const docId = `${userId}_${placeData.placeId}`
  await setDoc(doc(db, 'bookmarks', docId), {
    userId,
    placeId: placeData.placeId,
    placeName: placeData.name,
    placeAddress: placeData.address || '',
    placeLat: placeData.lat || null,
    placeLng: placeData.lng || null,
    createdAt: serverTimestamp()
  })
}

export async function removeBookmark(userId, placeId) {
  const docId = `${userId}_${placeId}`
  await deleteDoc(doc(db, 'bookmarks', docId))
}

export async function isBookmarked(userId, placeId) {
  const docId = `${userId}_${placeId}`
  const snap = await getDoc(doc(db, 'bookmarks', docId))
  return snap.exists()
}

export async function getBookmarks(userId) {
  const q = query(collection(db, 'bookmarks'), where('userId', '==', userId))
  const snap = await getDocs(q)
  return snap.docs.map(d => ({ id: d.id, ...d.data() }))
}

// --- BACKFILL ---

export async function backfillRecCoords(recs) {
  // Dynamically import to avoid circular deps
  const { getPlaceDetails } = await import('./places')
  let updated = 0
  for (const rec of recs) {
    try {
      const details = await getPlaceDetails(rec.restaurantPlaceId)
      if (details?.lat != null && details?.lng != null) {
        await updateDoc(doc(db, 'recommendations', rec.id), {
          restaurantLat: details.lat,
          restaurantLng: details.lng,
        })
        updated++
      }
    } catch (err) {
      console.error('Backfill failed for', rec.id, err)
    }
  }
  return updated
}

export async function backfillBookmarkCoords(bookmarks) {
  const { getPlaceDetails } = await import('./places')
  let updated = 0
  for (const bm of bookmarks) {
    try {
      const details = await getPlaceDetails(bm.placeId)
      if (details?.lat != null && details?.lng != null) {
        await updateDoc(doc(db, 'bookmarks', bm.id), {
          placeLat: details.lat,
          placeLng: details.lng,
        })
        updated++
      }
    } catch (err) {
      console.error('Bookmark backfill failed for', bm.id, err)
    }
  }
  return updated
}

// --- TRUSTI 9 ---

export async function getTrusti9(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return []
  return snap.data().trusti9 || []
}

export async function addToTrusti9(uid, targetUid) {
  const current = await getTrusti9(uid)
  if (current.length >= 9 || current.includes(targetUid)) return false
  await updateDoc(doc(db, 'users', uid), { trusti9: [...current, targetUid] })
  return true
}

export async function removeFromTrusti9(uid, targetUid) {
  const current = await getTrusti9(uid)
  await updateDoc(doc(db, 'users', uid), { trusti9: current.filter(id => id !== targetUid) })
}

// --- ACCESS CONTROL ---

export async function isUserApproved(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  if (!snap.exists()) return false
  return snap.data().approved === true
}

export async function approveUser(uid) {
  await updateDoc(doc(db, 'users', uid), { approved: true })
}
